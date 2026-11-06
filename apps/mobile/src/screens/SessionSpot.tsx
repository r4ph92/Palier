import type { AssignedSpot, CurrentParkingSession, EntrySessionState } from '@palier/shared-types';
import { useState } from 'react';
import { SpotWithState } from '../components/SpotLine';
import { SpotNumberText } from '../components/SpotNumberText';
import { useAccessibilityFocusOn } from '../components/useAccessibilityFocusOn';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import { isParked } from '../parkingSessions/isParked';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// walked: the walk alone parked the car; answered: the driver answered where it is, or corrected the presumed spot, and the form gave way to the spot.
export type ParkedArrival = 'walked' | 'answered' | null;

interface SessionSpotProps {
  readonly session: CurrentParkingSession;
  readonly arrival: ParkedArrival;
  readonly shouldFocusOnArrival: boolean;
}

// After an answer the focused field is gone, so the focus moves to the spot, which reads « Garé en B-3 » without an announcement on top.
// A new spot after a spot-taken report takes the focus the same way: its line reads « Nouvelle place : A-2 ».
export function SessionSpot({ session, arrival, shouldFocusOnArrival }: SessionSpotProps) {
  const colors = useColors();
  const isNewSpot = useNewSpot(session);
  const ref = useAccessibilityFocusOn(spotFocusKeyOf({ isNewSpot, spot: session.spot, focusesArrival: shouldFocusOnArrival || arrival === 'answered' }));
  const spotLead = spotLeadOf(session.state, isNewSpot);
  const status = spotLead === null ? waitingStatusOf(session.state) : `${spotLead}${session.spot.number}`;
  useAnnouncement(arrival === 'walked' ? status : null);
  const statusContent = spotLead === null ? undefined : <SpotStatus spot={session.spot} lead={spotLead} />;
  const markColor = session.state === 'CREATED' ? colors.muted : colors.free;
  return <SpotWithState ref={ref} spot={session.spot} statusLabel={status} statusContent={statusContent} markColor={markColor} />;
}

interface SpotFocus {
  readonly isNewSpot: boolean;
  readonly spot: AssignedSpot;
  readonly focusesArrival: boolean;
}

function spotFocusKeyOf({ isNewSpot, spot, focusesArrival }: SpotFocus): string | null {
  if (isNewSpot) {
    return `new:${spot.number}`;
  }
  return focusesArrival ? 'arrival' : null;
}

function spotLeadOf(state: EntrySessionState, isNewSpot: boolean): string | null {
  if (isNewSpot) {
    return i18n.t('session.spotTaken.newSpotLead');
  }
  return isParked(state) ? i18n.t('session.parkedInLead') : null;
}

function waitingStatusOf(state: EntrySessionState): string {
  return state === 'CREATED' ? i18n.t('session.pending') : i18n.t('scan.entryConfirmed');
}

interface SeenSpot {
  readonly sessionKey: string;
  readonly number: string;
  readonly isNew: boolean;
}

// The spot changed under a session waiting to park: a spot-taken report gave it another one. « Nouvelle place » stays
// until the session changes state; a session that opens on its spot, or another session, shows it as usual.
function useNewSpot({ sessionId, state, spot }: CurrentParkingSession): boolean {
  const sessionKey = `${sessionId}:${state}`;
  const [seen, setSeen] = useState<SeenSpot>({ sessionKey, number: spot.number, isNew: false });
  const next = nextSeenSpot(seen, { sessionKey, number: spot.number, isNew: state === 'ENTRY_CONFIRMED' });
  if (next !== seen) {
    setSeen(next);
  }
  return next.isNew;
}

function nextSeenSpot(seen: SeenSpot, current: SeenSpot): SeenSpot {
  if (current.sessionKey !== seen.sessionKey) {
    return { ...current, isNew: false };
  }
  return current.number === seen.number ? seen : current;
}

// The spot turns parked once, on that change only: not on the minute poll, and not for a screen that opens on a session already parked.
// Read above the question, which unmounts the spot while it is asked.
export function useParkedArrival({ state }: CurrentParkingSession): ParkedArrival {
  const [previousState, setPreviousState] = useState(state);
  const [arrival, setArrival] = useState<ParkedArrival>(null);
  if (state !== previousState) {
    setPreviousState(state);
    setArrival(parkedArrivalOf(previousState, state));
  }
  return arrival;
}

function parkedArrivalOf(previousState: EntrySessionState, state: EntrySessionState): ParkedArrival {
  if (previousState === 'PARKED_PRESUMED' && state === 'PARKED_CONFIRMED') {
    return 'answered';
  }
  if (!isParked(state) || isParked(previousState)) {
    return null;
  }
  return previousState === 'PARKED_UNCONFIRMED' ? 'answered' : 'walked';
}

// The spot number is a figure inside the sentence, in mono (docs/design.md, gesture 3).
function SpotStatus({ spot, lead }: { readonly spot: AssignedSpot; readonly lead: string }) {
  const colors = useColors();
  return <SpotNumberText spot={spot} lead={lead} style={[typography.bodyStrong, { color: colors.ink }]} numberStyle={typography.figureStrong} />;
}

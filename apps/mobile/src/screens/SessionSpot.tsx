import type { AssignedSpot, CurrentParkingSession, EntrySessionState } from '@palier/shared-types';
import { useState } from 'react';
import { SpotWithState } from '../components/SpotLine';
import { SpotNumberText } from '../components/SpotNumberText';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import { isParked } from '../parkingSessions/isParked';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// walked: the walk alone parked the car; answered: the driver answered where it is, and the question gave way to the spot.
export type ParkedArrival = 'walked' | 'answered' | null;

interface SessionSpotProps {
  readonly session: CurrentParkingSession;
  readonly arrival: ParkedArrival;
  readonly shouldFocusOnArrival: boolean;
}

// After an answer the focused field is gone, so the focus moves to the spot, which reads « Garé en B-3 » without an announcement on top.
export function SessionSpot({ session, arrival, shouldFocusOnArrival }: SessionSpotProps) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  const isWaiting = session.state === 'CREATED';
  const statusContent = isParked(session.state) ? <ParkedIn spot={session.spot} /> : undefined;
  useAnnouncement(arrival === 'walked' ? spotStatusOf(session) : null);
  const ref = shouldFocusOnArrival || arrival === 'answered' ? focusRef : null;
  return <SpotWithState ref={ref} spot={session.spot} statusLabel={spotStatusOf(session)} statusContent={statusContent} markColor={isWaiting ? colors.muted : colors.free} />;
}

function spotStatusOf({ state, spot }: CurrentParkingSession): string {
  if (isParked(state)) {
    return `${i18n.t('session.parkedInLead')}${spot.number}`;
  }
  switch (state) {
    case 'CREATED':
      return i18n.t('session.pending');
    case 'ENTRY_CONFIRMED':
    case 'PARKED_UNCONFIRMED':
      return i18n.t('scan.entryConfirmed');
  }
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
  if (!isParked(state) || isParked(previousState)) {
    return null;
  }
  return previousState === 'PARKED_UNCONFIRMED' ? 'answered' : 'walked';
}

// The spot number is a figure inside the sentence, in mono (docs/design.md, gesture 3).
function ParkedIn({ spot }: { readonly spot: AssignedSpot }) {
  const colors = useColors();
  return <SpotNumberText spot={spot} lead={i18n.t('session.parkedInLead')} style={[typography.bodyStrong, { color: colors.ink }]} numberStyle={typography.figureStrong} />;
}

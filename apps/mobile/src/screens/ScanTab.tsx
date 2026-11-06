import { useEffect, type ReactElement, type ReactNode } from 'react';
import { assertNever } from '../assertNever';
import type { EntryClient } from '../api/EntryClient';
import { LoadingState } from '../components/LoadingState';
import type { TabLabels } from '../components/TabBar';
import { useEntry, type EntryController, type EntryState } from '../entries/useEntry';
import type { PendingEntryWatch } from '../entries/usePendingEntryWatch';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { isParked } from '../parkingSessions/isParked';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanFrame, ScanScreen } from './ScanScreen';
import { SessionNotice } from './SessionNotice';

export interface SessionAside {
  readonly detectionNotice: ReactNode;
  readonly guidance: ReactNode;
}

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly gateScanner: (scanner: ReactElement) => ReactElement;
  readonly aside: SessionAside;
  readonly currentSession: CurrentParkingSessionController;
  readonly pendingEntry: PendingEntryWatch;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// While a session is current this tab hosts it, so the tab bar names it « Session ».
export function scanTabLabels(state: CurrentParkingSessionState): TabLabels {
  return state.status === 'current' ? { scan: i18n.t('tabs.session') } : {};
}

// An entry in progress keeps the scan screen, so its spot and announcement are never cut off by a refresh.
// Otherwise the tab waits for Palier's first answer, then shows the current session or the form.
export function ScanTab({ entryClient, gateScanner, aside, currentSession, pendingEntry, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient, pendingEntry);
  const { state, refresh, ...progress } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  useEndEntryOnceParked(entry, state);
  const sessionScreen = isEntryInProgress(entry.state) ? null : sessionScreenFor(currentSession, aside);
  if (sessionScreen !== null) {
    return sessionScreen;
  }
  const onDone = () => {
    entry.startOver();
    refresh();
  };
  const notice = <SessionNotice state={state} progress={progress} onRetry={refresh} />;
  return gateScanner(<ScanScreen entry={entry} notice={notice} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />);
}

// What replaces the scan form: nothing yet known, or a current session.
function sessionScreenFor({ state, refresh, ...progress }: CurrentParkingSessionController, aside: SessionAside): ReactElement | null {
  switch (state.status) {
    case 'loading':
      return (
        <ScanFrame>
          <LoadingState label={i18n.t('session.loading')} />
        </ScanFrame>
      );
    case 'current':
      return <CurrentParkingSessionScreen reading={state} progress={progress} onRetry={refresh} notice={aside.detectionNotice} guidance={aside.guidance} />;
    case 'none':
    case 'unknown':
      return null;
    default:
      return assertNever(state);
  }
}

// A cancelled entry keeps the scan screen too: its message stays on the form, whatever the session read answers.
function isEntryInProgress(state: EntryState): boolean {
  return state.status === 'submitting' || state.status === 'entered' || state.status === 'cancelled';
}

// The tab label turns to « Session » as soon as the barrier opens, and the state follows the loop confirmation; the watch refreshes on a cancellation.
function useRefreshAsEntryProgresses(state: EntryState, refresh: () => void): void {
  const progress = progressKey(state);
  useEffect(() => {
    if (progress !== null) {
      refresh();
    }
  }, [progress, refresh]);
}

function progressKey(state: EntryState): string | null {
  return state.status === 'entered' ? `${state.sessionId}:${String(state.isConfirmed)}` : null;
}

// A walk away from the car can come before « Terminé »: the scan result then gives way to the session presumed parked,
// and the entry is over, so a later closed session shows the form rather than this entry's spot.
function useEndEntryOnceParked(entry: EntryController, state: CurrentParkingSessionState): void {
  const enteredSessionId = entry.state.status === 'entered' ? entry.state.sessionId : null;
  const parkedSessionId = state.status === 'current' && isParked(state.session.state) ? state.session.sessionId : null;
  const { startOver } = entry;
  useEffect(() => {
    if (enteredSessionId !== null && enteredSessionId === parkedSessionId) {
      startOver();
    }
  }, [enteredSessionId, parkedSessionId, startOver]);
}

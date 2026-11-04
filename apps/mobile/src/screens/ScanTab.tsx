import { useEffect, type ReactElement } from 'react';
import { assertNever } from '../assertNever';
import type { EntryClient } from '../api/EntryClient';
import { LoadingState } from '../components/LoadingState';
import type { TabLabels } from '../components/TabBar';
import { useEntry, type EntryState } from '../entries/useEntry';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanFrame, ScanScreen } from './ScanScreen';
import { SessionNotice } from './SessionNotice';

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly currentSession: CurrentParkingSessionController;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// While a session is current this tab hosts it, so the tab bar names it « Session ».
export function scanTabLabels(state: CurrentParkingSessionState): TabLabels {
  return state.status === 'current' ? { scan: i18n.t('tabs.session') } : {};
}

// An entry in progress keeps the scan screen, so its spot, polling and announcement are never cut off by a refresh.
// Otherwise the tab waits for Palier's first answer, then shows the current session or the form.
export function ScanTab({ entryClient, currentSession, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient);
  const { state, refresh, ...progress } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  const sessionScreen = isEntryInProgress(entry.state) ? null : sessionScreenFor(currentSession);
  if (sessionScreen !== null) {
    return sessionScreen;
  }
  const onDone = () => {
    entry.startOver();
    refresh();
  };
  return <ScanScreen entry={entry} notice={<SessionNotice state={state} progress={progress} onRetry={refresh} />} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />;
}

// What replaces the scan form: nothing yet known, or a current session.
function sessionScreenFor({ state, refresh, ...progress }: CurrentParkingSessionController): ReactElement | null {
  switch (state.status) {
    case 'loading':
      return (
        <ScanFrame>
          <LoadingState label={i18n.t('session.loading')} />
        </ScanFrame>
      );
    case 'current':
      return <CurrentParkingSessionScreen reading={state} progress={progress} onRetry={refresh} />;
    case 'none':
    case 'unknown':
      return null;
    default:
      return assertNever(state);
  }
}

function isEntryInProgress(state: EntryState): boolean {
  return state.status === 'submitting' || state.status === 'entered';
}

// The tab label turns to « Session » as soon as the barrier opens, and the state follows the loop confirmation.
function useRefreshAsEntryProgresses(state: EntryState, refresh: () => void): void {
  const progress = state.status === 'entered' ? `${state.sessionId}:${String(state.isConfirmed)}` : null;
  useEffect(() => {
    if (progress !== null) {
      refresh();
    }
  }, [progress, refresh]);
}

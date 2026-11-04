import { useEffect, type ReactElement } from 'react';
import { assertNever } from '../assertNever';
import type { EntryClient } from '../api/EntryClient';
import { LoadingState } from '../components/LoadingState';
import type { TabLabels } from '../components/TabBar';
import { unconfirmedSessionId, useEntry, type EntryController, type EntryState } from '../entries/useEntry';
import type { PendingEntryWatch } from '../entries/usePendingEntryWatch';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanFrame, ScanScreen } from './ScanScreen';
import { SessionNotice } from './SessionNotice';

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly currentSession: CurrentParkingSessionController;
  readonly pendingEntry: PendingEntryWatch;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// While a session is current this tab hosts it, so the tab bar names it « Session ».
export function scanTabLabels(state: CurrentParkingSessionState): TabLabels {
  return state.status === 'current' ? { scan: i18n.t('tabs.session') } : {};
}

// An entry in progress keeps the scan screen, so its spot, polling and announcement are never cut off by a refresh.
// Otherwise the tab waits for Palier's first answer, then shows the current session or the form.
export function ScanTab({ entryClient, currentSession, pendingEntry, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient);
  const { state, refresh, ...progress } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  const sessionScreen = isEntryInProgress(entry.state) ? null : sessionScreenFor(currentSession);
  if (sessionScreen !== null) {
    return sessionScreen;
  }
  const onDone = () => {
    watchIfUnconfirmed(entry.state, pendingEntry);
    entry.startOver();
    refresh();
  };
  const notice = <SessionNotice state={state} progress={progress} onRetry={refresh} />;
  return <ScanScreen entry={withPendingEntry(entry, pendingEntry)} notice={notice} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />;
}

// « Terminé » before the loop closed: the entry is still followed from above the tabs, in case Palier cancels it.
function watchIfUnconfirmed(state: EntryState, pendingEntry: PendingEntryWatch): void {
  const sessionId = unconfirmedSessionId(state);
  if (sessionId !== null) {
    pendingEntry.watch(sessionId);
  }
}

// A cancellation that comes after « Terminé » reads as one on this screen would, above the form, until the next scan.
function withPendingEntry(entry: EntryController, pendingEntry: PendingEntryWatch): EntryController {
  const { cancelledSessionId } = pendingEntry;
  const submit = () => {
    pendingEntry.clear();
    entry.submit();
  };
  const isShowingCancellation = cancelledSessionId !== null && entry.state.status === 'idle';
  return { ...entry, submit, state: isShowingCancellation ? { status: 'cancelled', sessionId: cancelledSessionId } : entry.state };
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

// A cancelled entry keeps the scan screen too: its message stays on the form, whatever the session read answers.
function isEntryInProgress(state: EntryState): boolean {
  return state.status === 'submitting' || state.status === 'entered' || state.status === 'cancelled';
}

// The tab label turns to « Session » as soon as the barrier opens, and the state follows the loop confirmation or the cancellation.
function useRefreshAsEntryProgresses(state: EntryState, refresh: () => void): void {
  const progress = progressKey(state);
  useEffect(() => {
    if (progress !== null) {
      refresh();
    }
  }, [progress, refresh]);
}

function progressKey(state: EntryState): string | null {
  switch (state.status) {
    case 'entered':
      return `${state.sessionId}:${String(state.isConfirmed)}`;
    case 'cancelled':
      return `${state.sessionId}:cancelled`;
    default:
      return null;
  }
}

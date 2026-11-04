import { useEffect } from 'react';
import type { EntryClient } from '../api/EntryClient';
import { useEntry, type EntryState } from '../entries/useEntry';
import type { CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanScreen } from './ScanScreen';

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly currentSession: CurrentParkingSessionController;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// An entry in progress keeps the scan screen, so its spot, polling and announcement are never cut off by a refresh.
// Otherwise a current session replaces the form; without one, the form shows.
export function ScanTab({ entryClient, currentSession, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient);
  const { state, refresh } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  if (isEntryInProgress(entry.state) || state.status !== 'current') {
    const onDone = () => {
      entry.startOver();
      refresh();
    };
    return <ScanScreen entry={entry} hasNoSession={state.status === 'none'} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />;
  }
  return <CurrentParkingSessionScreen session={state.session} readAt={state.readAt} />;
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

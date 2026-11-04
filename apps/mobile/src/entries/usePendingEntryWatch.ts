import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntryClient } from '../api/EntryClient';
import { useConfirmationPolling } from './useConfirmationPolling';

export interface PendingEntryWatch {
  // The entry Palier cancelled after the driver left its screen; null until then, and again after the next scan.
  readonly cancelledSessionId: string | null;
  watch(sessionId: string): void;
  clear(): void;
}

interface WatchState {
  readonly watchedSessionId: string | null;
  readonly cancelledSessionId: string | null;
}

const NOTHING_WATCHED: WatchState = { watchedSessionId: null, cancelledSessionId: null };

// Owned above the tabs, so an entry left unconfirmed with « Terminé » is still followed while the driver browses other tabs.
// onCancelled is kept in a ref: a caller passing a new function on each render never restarts the polling.
export function usePendingEntryWatch(client: EntryClient, onCancelled: () => void): PendingEntryWatch {
  const [watchState, setWatchState] = useState<WatchState>(NOTHING_WATCHED);
  const latestOnCancelled = useRef(onCancelled);
  useEffect(() => {
    latestOnCancelled.current = onCancelled;
  });
  const stopWatching = useCallback(() => setWatchState((previous) => ({ ...previous, watchedSessionId: null })), []);
  const cancel = useCallback(() => {
    latestOnCancelled.current();
    setWatchState((previous) => ({ watchedSessionId: null, cancelledSessionId: previous.watchedSessionId }));
  }, []);
  // Thrown inside the state update, like in useEntry, so an unexpected error reaches the error boundary.
  const fail = useCallback((error: unknown) => setWatchState(() => { throw error; }), []);
  useConfirmationPolling(client, watchState.watchedSessionId, { onConfirmed: stopWatching, onCancelled: cancel, onUnexpectedError: fail });
  const watch = useCallback((sessionId: string) => setWatchState({ watchedSessionId: sessionId, cancelledSessionId: null }), []);
  const clear = useCallback(() => setWatchState(NOTHING_WATCHED), []);
  return { cancelledSessionId: watchState.cancelledSessionId, watch, clear };
}

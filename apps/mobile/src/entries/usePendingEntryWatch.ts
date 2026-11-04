import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntryClient } from '../api/EntryClient';
import { useConfirmationPolling } from './useConfirmationPolling';

export type FollowedEntryOutcome = 'waiting' | 'confirmed' | 'cancelled';

export interface FollowedEntry {
  readonly sessionId: string;
  readonly outcome: FollowedEntryOutcome;
}

export interface PendingEntryWatch {
  // The last entry the barrier opened for and what became of it; null again once the next scan starts.
  readonly followed: FollowedEntry | null;
  watch(sessionId: string): void;
  clear(): void;
}

// Owned above the tabs, so the one polling of an entry outlives the scan tab while the driver browses the others.
export function usePendingEntryWatch(client: EntryClient, onCancelled: () => void): PendingEntryWatch {
  const [followed, setFollowed] = useState<FollowedEntry | null>(null);
  const latestOnCancelled = useRef(onCancelled);
  useEffect(() => {
    latestOnCancelled.current = onCancelled;
  });
  const confirm = useCallback(() => setFollowed(withOutcome('confirmed')), []);
  const cancel = useCallback(() => {
    setFollowed(withOutcome('cancelled'));
    latestOnCancelled.current();
  }, []);
  // Thrown inside the state update, like in useEntry, so an unexpected error reaches the error boundary.
  const fail = useCallback((error: unknown) => setFollowed(() => { throw error; }), []);
  useConfirmationPolling(client, waitingEntry(followed), { onConfirmed: confirm, onCancelled: cancel, onUnexpectedError: fail });
  const watch = useCallback((sessionId: string) => setFollowed({ sessionId, outcome: 'waiting' }), []);
  const clear = useCallback(() => setFollowed(null), []);
  return { followed, watch, clear };
}

// The followed object itself is polled, so a new scan restarts the polling even if Palier answered the same session id.
function waitingEntry(followed: FollowedEntry | null): FollowedEntry | null {
  return followed?.outcome === 'waiting' ? followed : null;
}

function withOutcome(outcome: FollowedEntryOutcome): (previous: FollowedEntry | null) => FollowedEntry | null {
  return (previous) => (previous === null ? null : { ...previous, outcome });
}

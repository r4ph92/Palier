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
  // Called when a submission ends, entered or refused: an entry made from a spot hold uses it up.
  answered(): void;
  clear(): void;
}

// Owned above the tabs, so the one polling of an entry outlives the scan tab while the driver browses the others.
export function usePendingEntryWatch(client: EntryClient, onSettled: () => void, onAnswered: () => void): PendingEntryWatch {
  const [followed, setFollowed] = useState<FollowedEntry | null>(null);
  const latestOnSettled = useLatest(onSettled);
  const latestOnAnswered = useLatest(onAnswered);
  const settle = useCallback((outcome: FollowedEntryOutcome) => {
    setFollowed(withOutcome(outcome));
    latestOnSettled.current();
  }, [latestOnSettled]);
  const confirm = useCallback(() => settle('confirmed'), [settle]);
  const cancel = useCallback(() => settle('cancelled'), [settle]);
  // Thrown inside the state update, like in useEntry, so an unexpected error reaches the error boundary.
  const fail = useCallback((error: unknown) => setFollowed(() => { throw error; }), []);
  useConfirmationPolling(client, waitingEntry(followed), { onConfirmed: confirm, onCancelled: cancel, onUnexpectedError: fail });
  const watch = useCallback((sessionId: string) => setFollowed({ sessionId, outcome: 'waiting' }), []);
  const clear = useCallback(() => setFollowed(null), []);
  const answered = useCallback(() => latestOnAnswered.current(), [latestOnAnswered]);
  return { followed, watch, answered, clear };
}

function useLatest<T>(value: T): { readonly current: T } {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  return latest;
}

// The followed object itself is polled, so a new scan restarts the polling even if Palier answered the same session id.
function waitingEntry(followed: FollowedEntry | null): FollowedEntry | null {
  return followed?.outcome === 'waiting' ? followed : null;
}

function withOutcome(outcome: FollowedEntryOutcome): (previous: FollowedEntry | null) => FollowedEntry | null {
  return (previous) => (previous === null ? null : { ...previous, outcome });
}

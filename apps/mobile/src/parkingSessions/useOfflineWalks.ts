import { useCallback, useEffect, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import type { OfflineWalkSender } from './OfflineWalkSender';

export const SENT_NOTICE_MILLISECONDS = 8000;

// The walks of the session on screen: kept until Palier can be reached, and those just sent.
export interface OfflineWalks {
  readonly pending: number;
  readonly sent: number;
}

const NO_WALKS: OfflineWalks = { pending: 0, sent: 0 };

export function useOfflineWalks(sender: OfflineWalkSender, sessionId: string | null): OfflineWalks {
  const pending = usePendingWalks(sender, sessionId);
  const sent = useSentWalks(sender, sessionId);
  return sessionId === null ? NO_WALKS : { pending, sent };
}

function usePendingWalks(sender: OfflineWalkSender, sessionId: string | null): number {
  const subscribe = useCallback((onChange: () => void) => sender.subscribe({ onChange }), [sender]);
  return useSyncExternalStore(subscribe, () => (sessionId === null ? 0 : sender.pendingFor(sessionId)));
}

interface SentCount {
  readonly sessionId: string | null;
  readonly count: number;
}

// « 1 signal envoyé » stays 8 s, counted again from the last walk sent; another session starts from nothing.
function useSentWalks(sender: OfflineWalkSender, sessionId: string | null): number {
  const [sent, setSent] = useState<SentCount>({ sessionId, count: 0 });
  useEffect(() => countSentWalks(sender, sessionId, setSent), [sender, sessionId]);
  return sent.sessionId === sessionId ? sent.count : 0;
}

function countSentWalks(sender: OfflineWalkSender, sessionId: string | null, setSent: Dispatch<SetStateAction<SentCount>>): () => void {
  let clearing: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = sender.subscribe({
    onReplayed: (walk) => {
      if (walk.sessionId !== sessionId) {
        return;
      }
      setSent((previous) => ({ sessionId, count: previous.sessionId === sessionId ? previous.count + 1 : 1 }));
      clearTimeout(clearing);
      clearing = setTimeout(() => setSent({ sessionId, count: 0 }), SENT_NOTICE_MILLISECONDS);
    },
  });
  return () => {
    unsubscribe();
    clearTimeout(clearing);
  };
}

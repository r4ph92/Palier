import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ConnectivityMonitor } from '../positioning/ConnectivityMonitor';
import type { ParkedSignalQueue } from './ParkedSignalQueue';

export const SENT_BANNER_MILLISECONDS = 5000;

export interface ParkedSignalBanner {
  readonly kind: 'waiting' | 'sent';
  readonly count: number;
}

// « Hors ligne — 1 signal en attente » while walks wait with the network down, then « 1 signal envoyé » for 5 seconds.
export function useParkedSignalBanner(queue: ParkedSignalQueue, monitor: ConnectivityMonitor): ParkedSignalBanner | null {
  const waiting = useSyncExternalStore(
    (notify) => queue.subscribe(notify),
    () => queue.count,
  );
  const connectivity = useSyncExternalStore(
    (notify) => monitor.subscribe(notify),
    () => monitor.current,
  );
  const sent = useSentCount(queue);
  if (connectivity === 'offline' && waiting > 0) {
    return { kind: 'waiting', count: waiting };
  }
  return sent > 0 ? { kind: 'sent', count: sent } : null;
}

// The walks sent since the banner was last cleared; it clears itself after 5 seconds.
function useSentCount(queue: ParkedSignalQueue): number {
  const [sent, setSent] = useState(0);
  useEffect(() => queue.onSent((count) => setSent((previous) => previous + count)), [queue]);
  useEffect(() => {
    if (sent === 0) {
      return;
    }
    const timer = setTimeout(() => setSent(0), SENT_BANNER_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [sent]);
  return sent;
}

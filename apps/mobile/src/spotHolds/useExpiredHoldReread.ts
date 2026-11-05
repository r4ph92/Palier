import { useEffect } from 'react';

export const EXPIRED_HOLD_REREAD_MILLISECONDS = 5000;

// The server frees an expired hold at its next check, up to 30 s after the end: the hold is read again until it answers none.
export function useExpiredHoldReread(isExpired: boolean, refreshHold: () => void): void {
  useEffect(() => {
    if (!isExpired) {
      return undefined;
    }
    const timer = setInterval(refreshHold, EXPIRED_HOLD_REREAD_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isExpired, refreshHold]);
}

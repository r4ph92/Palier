import { useEffect, useRef } from 'react';
import type { HoldCountdown } from './heldSpot';

export const EXPIRED_HOLD_REREAD_MILLISECONDS = 5000;

interface ExpiredHoldActions {
  readonly refreshHold: () => void;
  readonly onEnded: () => void;
}

// An expired hold is read again until the server answers none, then the lots are read for the spot it freed.
export function useExpiredHold(countdown: HoldCountdown | null, { refreshHold, onEnded }: ExpiredHoldActions): void {
  const isExpired = countdown?.kind === 'expired';
  const wasExpired = useRef(false);
  useEffect(() => {
    if (!isExpired) {
      return undefined;
    }
    const timer = setInterval(refreshHold, EXPIRED_HOLD_REREAD_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isExpired, refreshHold]);
  useEffect(() => {
    if (countdown === null && wasExpired.current) {
      onEnded();
    }
    wasExpired.current = isExpired;
  }, [countdown, isExpired, onEnded]);
}

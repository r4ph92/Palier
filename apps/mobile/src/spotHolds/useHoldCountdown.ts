import { useEffect, useState } from 'react';
import { holdCountdown, type HeldSpot, type HoldCountdown } from './heldSpot';

const TICK_MILLISECONDS = 1000;

// Ticks only while time is left. A device time older than the latest read counts as the moment of that read.
export function useHoldCountdown(held: HeldSpot | null): HoldCountdown | null {
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  const countdown = held === null ? null : holdCountdown(held, deviceNow);
  const isCounting = countdown?.kind === 'counting';
  useEffect(() => {
    if (!isCounting) {
      return undefined;
    }
    const timer = setInterval(() => setDeviceNow(Date.now()), TICK_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isCounting]);
  return countdown;
}

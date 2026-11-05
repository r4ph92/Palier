import { useEffect, useState } from 'react';
import { holdCountdown, type HeldSpot, type HoldCountdown } from './heldSpot';

const TICK_MILLISECONDS = 1000;

export interface RunningHold {
  readonly held: HeldSpot;
  readonly countdown: HoldCountdown;
}

// Ticks only while time is left. A device time older than the latest read counts as the moment of that read.
export function useHoldCountdown(held: HeldSpot | null): RunningHold | null {
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  const running = held === null ? null : { held, countdown: holdCountdown(held, deviceNow) };
  const isCounting = running?.countdown.kind === 'counting';
  useEffect(() => {
    if (!isCounting) {
      return undefined;
    }
    const timer = setInterval(() => setDeviceNow(Date.now()), TICK_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isCounting]);
  return running;
}

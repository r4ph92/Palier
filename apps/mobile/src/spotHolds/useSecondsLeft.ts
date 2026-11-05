import { useEffect, useState } from 'react';
import { secondsLeft, type HeldSpot } from './heldSpot';

const TICK_MILLISECONDS = 1000;

// Ticks only while the banner is on screen and time is left: at 0 the countdown stops.
export function useSecondsLeft(held: HeldSpot): number {
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  const left = secondsLeft(held, deviceNow);
  const isOver = left === 0;
  useEffect(() => {
    if (isOver) {
      return undefined;
    }
    const timer = setInterval(() => setDeviceNow(Date.now()), TICK_MILLISECONDS);
    return () => clearInterval(timer);
  }, [isOver]);
  return left;
}

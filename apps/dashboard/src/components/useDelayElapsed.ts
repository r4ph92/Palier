import { useEffect, useState } from 'react';

// True once the delay has passed since mount, so a quick answer never flashes a placeholder.
export function useDelayElapsed(delayMilliseconds: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), delayMilliseconds);
    return () => window.clearTimeout(timer);
  }, [delayMilliseconds]);
  return elapsed;
}

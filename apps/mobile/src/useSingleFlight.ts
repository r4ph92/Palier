import { useCallback, useRef, useState } from 'react';

// The ref refuses a second task while one runs, so a double tap sends one request.
export function useSingleFlight<Key>() {
  const [runningKey, setRunningKey] = useState<Key | null>(null);
  const isRunning = useRef(false);
  const run = useCallback((key: Key, task: () => Promise<void>) => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setRunningKey(key);
    void task().finally(() => {
      isRunning.current = false;
      setRunningKey(null);
    });
  }, []);
  return { runningKey, run };
}

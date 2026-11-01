export interface SetupLimiter {
  allow(key: string): boolean;
  readonly trackedKeys: number;
}

// Counts attempts per key in a sliding window. It lives in memory, so each server process has its own count.
export function createSetupLimiter(limit: number, windowMilliseconds: number): SetupLimiter {
  const attempts = new Map<string, number[]>();
  const sweep = idleKeySweeper(attempts, windowMilliseconds);
  return {
    allow(key: string): boolean {
      const now = Date.now();
      sweep(now);
      const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMilliseconds);
      if (recent.length >= limit) {
        return false;
      }
      attempts.set(key, [...recent, now]);
      return true;
    },
    get trackedKeys(): number {
      return attempts.size;
    },
  };
}

// Without this, every address that ever called would stay in the map for the life of the process.
// It runs at most once per window, so a busy server does not scan the whole map on every request.
function idleKeySweeper(attempts: Map<string, number[]>, windowMilliseconds: number): (now: number) => void {
  let lastSweep = 0;
  return (now: number) => {
    if (now - lastSweep < windowMilliseconds) {
      return;
    }
    lastSweep = now;
    for (const [key, times] of attempts) {
      if (times.every((time) => now - time >= windowMilliseconds)) {
        attempts.delete(key);
      }
    }
  };
}

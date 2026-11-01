export interface SetupLimiter {
  allow(key: string): boolean;
}

// Counts attempts per key in a sliding window. It lives in memory, so each server process has its own count.
export function createSetupLimiter(limit: number, windowMilliseconds: number): SetupLimiter {
  const attempts = new Map<string, number[]>();
  return {
    allow(key: string): boolean {
      const now = Date.now();
      forgetIdleKeys(attempts, now, windowMilliseconds);
      const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMilliseconds);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(now);
      attempts.set(key, recent);
      return true;
    },
  };
}

// Without this, every address that ever called would stay in the map for the life of the process.
function forgetIdleKeys(attempts: Map<string, number[]>, now: number, windowMilliseconds: number): void {
  for (const [key, times] of attempts) {
    if (times.every((time) => now - time >= windowMilliseconds)) {
      attempts.delete(key);
    }
  }
}

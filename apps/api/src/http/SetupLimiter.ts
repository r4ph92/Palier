export interface SetupLimiter {
  allow(driverId: string): boolean;
}

// Counts setups per driver in a sliding window. It lives in memory, so each server process has its own count.
export function createSetupLimiter(limit: number, windowMilliseconds: number): SetupLimiter {
  const attempts = new Map<string, number[]>();
  return {
    allow(driverId: string): boolean {
      const now = Date.now();
      const recent = (attempts.get(driverId) ?? []).filter((time) => now - time < windowMilliseconds);
      if (recent.length >= limit) {
        attempts.set(driverId, recent);
        return false;
      }
      recent.push(now);
      attempts.set(driverId, recent);
      return true;
    },
  };
}

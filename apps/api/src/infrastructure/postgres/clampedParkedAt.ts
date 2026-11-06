import { sql, type SQL } from 'drizzle-orm';

// The device clock is trusted only up to the database clock, and never before the loop confirmation, whose gate clock may run ahead.
export function clampedParkedAt(detectedAt: Date): SQL {
  return sql`greatest(least(${detectedAt.toISOString()}::timestamptz, now()), entry_confirmed_at)`;
}

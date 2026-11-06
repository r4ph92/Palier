import { sql, type SQL } from 'drizzle-orm';
import type { UsableSpotHoldQuery } from '../../domain/spotHolds/SpotHoldRepository.ts';

// One text for the partial indexes and every hold query, so they agree on what "active" means; the time rule is spotHoldEndedAt and spotHoldRunningAt.
export const ACTIVE_SPOT_HOLD = sql.raw(`status = 'ACTIVE'`);

// A hold ends at its expires_at, on the API's clock: from that instant the expiry job ends it and no entry may use it.
export function spotHoldEndedAt(now: Date): SQL {
  return sql`expires_at <= ${now.toISOString()}::timestamptz`;
}

export function spotHoldRunningAt(now: Date): SQL {
  return sql`expires_at > ${now.toISOString()}::timestamptz`;
}

export function usableSpotHold({ driverId, lotId, now }: UsableSpotHoldQuery): SQL {
  return sql`user_id = ${driverId} and lot_id = ${lotId} and ${ACTIVE_SPOT_HOLD} and ${spotHoldRunningAt(now)}`;
}

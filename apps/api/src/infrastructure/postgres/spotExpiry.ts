import { sql } from 'drizzle-orm';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';

// Same comparison as releaseSpotHold: a hold is over at the instant it ends. Returns the spots of the holds it ended.
export async function markSpotHoldsExpired(tx: Pick<Transaction, 'execute'>, lotId: string, now: Date): Promise<string[]> {
  const rows = await tx.execute<{ spot_id: string }>(sql`
    update spot_hold set status = 'EXPIRED'
    where lot_id = ${lotId} and ${ACTIVE_SPOT_HOLD} and expires_at <= ${now.toISOString()}::timestamptz
    returning spot_id`);
  return rows.map(({ spot_id }) => spot_id);
}

export async function findLotsWithExpiredHolds(tx: Pick<Transaction, 'execute'>, now: Date): Promise<string[]> {
  const rows = await tx.execute<{ lot_id: string }>(sql`
    select distinct lot_id from spot_hold where ${ACTIVE_SPOT_HOLD} and expires_at <= ${now.toISOString()}::timestamptz`);
  return rows.map(({ lot_id }) => lot_id);
}

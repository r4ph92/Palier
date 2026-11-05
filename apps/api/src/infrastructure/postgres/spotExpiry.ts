import { sql } from 'drizzle-orm';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'>;

// Returns the spots of the holds it ended.
export async function markSpotHoldsExpired(tx: Executor, lotId: string, now: Date): Promise<string[]> {
  const rows = await tx.execute<{ spot_id: string }>(sql`
    update spot_hold set status = 'EXPIRED'
    where lot_id = ${lotId} and ${ACTIVE_SPOT_HOLD} and expires_at <= ${now.toISOString()}::timestamptz
    returning spot_id`);
  return rows.map(({ spot_id }) => spot_id);
}

// Returns how many of the spots were still held.
export async function freeHeldSpots(tx: Executor, spotIds: readonly string[], freedAt: Date): Promise<number> {
  if (spotIds.length === 0) {
    return 0;
  }
  const rows = await tx.execute<{ id: string }>(sql`
    update spot set state = 'AVAILABLE', state_changed_at = ${freedAt.toISOString()}::timestamptz
    where id in (${sql.join(spotIds.map((spotId) => sql`${spotId}`), sql`, `)}) and state = 'HELD'
    returning id`);
  return rows.length;
}

export async function findLotsWithExpiredHolds(tx: Executor, now: Date): Promise<string[]> {
  const rows = await tx.execute<{ lot_id: string }>(sql`
    select distinct lot_id from spot_hold where ${ACTIVE_SPOT_HOLD} and expires_at <= ${now.toISOString()}::timestamptz`);
  return rows.map(({ lot_id }) => lot_id);
}

import { sql, type SQL } from 'drizzle-orm';
import { ACTIVE_SPOT_HOLD, spotHoldEndedAt } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'>;

export interface LotHoldsEnding {
  readonly lotId: string;
  readonly status: 'EXPIRED' | 'RELEASED';
  // Narrows the active holds to end; every active hold of the lot without it.
  readonly onlyWhen?: SQL;
}

// Ends active holds of one lot; returns their spots, for freeHeldSpots.
export async function endLotSpotHolds(tx: Executor, { lotId, status, onlyWhen }: LotHoldsEnding): Promise<string[]> {
  const narrowing = onlyWhen === undefined ? sql`` : sql` and ${onlyWhen}`;
  const rows = await tx.execute<{ spot_id: string }>(sql`
    update spot_hold set status = ${sql.raw(`'${status}'`)}
    where lot_id = ${lotId} and ${ACTIVE_SPOT_HOLD}${narrowing}
    returning spot_id`);
  return rows.map(({ spot_id }) => spot_id);
}

export function markSpotHoldsExpired(tx: Executor, lotId: string, now: Date): Promise<string[]> {
  return endLotSpotHolds(tx, { lotId, status: 'EXPIRED', onlyWhen: spotHoldEndedAt(now) });
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
    select distinct lot_id from spot_hold where ${ACTIVE_SPOT_HOLD} and ${spotHoldEndedAt(now)}`);
  return rows.map(({ lot_id }) => lot_id);
}

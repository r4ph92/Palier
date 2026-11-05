import { sql, type SQL } from 'drizzle-orm';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';
import type { AssignedSpotRow } from './spotClaim.ts';

export interface UsableHoldQuery {
  readonly driverId: string;
  readonly lotId: string;
  readonly now: Date;
}

// A hold past its end is not usable even before the expiry job has ended it; the instant is the API's clock, like the hold's own (decision 016).
export function usableSpotHold({ driverId, lotId, now }: UsableHoldQuery): SQL {
  return sql`user_id = ${driverId} and lot_id = ${lotId} and ${ACTIVE_SPOT_HOLD} and expires_at > ${now.toISOString()}::timestamptz`;
}

// Under the lot lock: ends the driver's usable hold in this lot and turns its held spot into the entry's assigned spot.
export async function useHeldSpot(tx: Pick<Transaction, 'execute'>, query: UsableHoldQuery): Promise<AssignedSpotRow | undefined> {
  const used = await tx.execute<{ spot_id: string }>(sql`
    update spot_hold set status = 'USED' where ${usableSpotHold(query)} returning spot_id`);
  const spotId = used[0]?.spot_id;
  return spotId === undefined ? undefined : await assignHeldSpot(tx, spotId);
}

async function assignHeldSpot(tx: Pick<Transaction, 'execute'>, spotId: string): Promise<AssignedSpotRow> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    update spot set state = 'ASSIGNED', state_changed_at = now()
    from aisle, level
    where spot.id = ${spotId} and spot.state = 'HELD' and aisle.id = spot.aisle_id and level.id = aisle.level_id
    returning spot.id, spot.number, aisle.code as aisle_code, level.code as level_code`);
  const assigned = rows[0];
  if (assigned === undefined) {
    throw new Error(`The held spot ${spotId} of a used hold was not held: the entry is rolled back.`);
  }
  return assigned;
}

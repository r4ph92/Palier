import { sql } from 'drizzle-orm';
import type { SpotHoldRelease } from '../../domain/spotHolds/SpotHoldRepository.ts';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';
import { freeHeldSpots } from './spotExpiry.ts';

// The driver predicate repeats the one that found the hold, so the update itself can never touch someone else's row.
// Returns the freed hold's spot, or undefined when a concurrent release or expiry got there first.
export async function markSpotHoldReleased(tx: Pick<Transaction, 'execute'>, { driverId, spotHoldId }: SpotHoldRelease): Promise<string | undefined> {
  const rows = await tx.execute<{ spot_id: string }>(sql`
    update spot_hold set status = 'RELEASED'
    where id = ${spotHoldId} and user_id = ${driverId} and ${ACTIVE_SPOT_HOLD}
    returning spot_id`);
  return rows[0]?.spot_id;
}

export async function freeHeldSpot(tx: Pick<Transaction, 'execute'>, spotId: string, releasedAt: Date): Promise<boolean> {
  return (await freeHeldSpots(tx, [spotId], releasedAt)) === 1;
}

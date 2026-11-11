import { sql } from 'drizzle-orm';
import type { SpotHoldFacts } from '../../domain/spotHolds/decideSpotHoldRequest.ts';
import { ACTIVE_SPOT_HOLD } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';
import { heldSpotCountOf } from './heldSpotCount.ts';
import type { LockedParkingLot } from './lockParkingLot.ts';

interface SpotHoldFactsRow extends Record<string, unknown> {
  readonly own_active_hold: boolean;
  readonly active_holds_in_lot: number;
  readonly held_spot_count: number;
}

// Run after lockParkingLot: no other hold of the lot can change these counts before the decision is applied.
export async function readSpotHoldFacts(tx: Pick<Transaction, 'execute'>, lot: LockedParkingLot, driverId: string): Promise<SpotHoldFacts> {
  const rows = await tx.execute<SpotHoldFactsRow>(sql`
    select
      exists (select 1 from spot_hold where user_id = ${driverId} and ${ACTIVE_SPOT_HOLD}) as own_active_hold,
      (select count(*)::int from spot_hold where lot_id = ${lot.id} and ${ACTIVE_SPOT_HOLD}) as active_holds_in_lot,
      ${heldSpotCountOf(lot.id)} as held_spot_count`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The spot hold facts query answered no row.');
  }
  return {
    isLotOnline: lot.isOnline,
    hasOwnActiveHold: row.own_active_hold,
    activeHoldsInLot: row.active_holds_in_lot,
    holdQuota: lot.holdQuota,
    occupancy: { capacity: lot.capacity, vehicleCount: lot.vehicleCount, heldSpotCount: row.held_spot_count },
  };
}

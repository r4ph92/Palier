import { sql } from 'drizzle-orm';
import { spotFits } from '../../domain/allocation/chooseSpotFor.ts';
import type { UsableSpotHoldQuery } from '../../domain/spotHolds/SpotHoldRepository.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import { usableSpotHold } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';
import { ASSIGNED_TO_ENTRY, spotFlagsOf, transitionSpot, type AssignedSpotRow, type SpotFlagsRow } from './spotClaim.ts';
import { freeHeldSpot, markSpotHoldReleased } from './spotRelease.ts';

type Executor = Pick<Transaction, 'execute'>;

export interface HeldSpotRow extends SpotFlagsRow, Record<string, unknown> {
  readonly hold_id: string;
  readonly spot_id: string;
}

// Every function here needs the lot lock.
export async function readHeldSpot(tx: Executor, query: UsableSpotHoldQuery): Promise<HeldSpotRow | undefined> {
  const rows = await tx.execute<HeldSpotRow>(sql`
    select h.id as hold_id, h.spot_id, s.is_ev, s.is_accessible, s.is_oversize
    from (select id, spot_id from spot_hold where ${usableSpotHold(query)}) h
    join spot s on s.id = h.spot_id`);
  return rows[0];
}

export function heldSpotFits(needs: VehicleNeeds, held: HeldSpotRow | undefined): held is HeldSpotRow {
  return held !== undefined && spotFits(needs, spotFlagsOf(held));
}

export async function consumeHeldSpot(tx: Executor, query: UsableSpotHoldQuery, held: HeldSpotRow): Promise<AssignedSpotRow> {
  await markSpotHoldUsed(tx, held.hold_id, query);
  const assigned = await transitionSpot(tx, { spotId: held.spot_id, from: 'HELD', target: ASSIGNED_TO_ENTRY });
  if (assigned === undefined) {
    throw new Error(`The held spot ${held.spot_id} of a used hold was not held: the entry is rolled back.`);
  }
  return assigned;
}

// The driver was seated elsewhere in this lot, so her guarantee ends: she must not count twice (decision 016).
export async function releaseUnfitHold(tx: Executor, { driverId, lotId, now }: UsableSpotHoldQuery, held: HeldSpotRow): Promise<void> {
  const spotId = await markSpotHoldReleased(tx, { driverId, lotId, spotHoldId: held.hold_id, releasedAt: now });
  if (spotId === undefined) {
    throw new Error(`The hold ${held.hold_id} read under the lot lock was not active: the entry is rolled back.`);
  }
  if (!(await freeHeldSpot(tx, spotId, now))) {
    throw new Error(`The held spot ${spotId} of a released hold was not held: the entry is rolled back.`);
  }
}

async function markSpotHoldUsed(tx: Executor, spotHoldId: string, query: UsableSpotHoldQuery): Promise<void> {
  const rows = await tx.execute(sql`
    update spot_hold set status = 'USED' where id = ${spotHoldId} and ${usableSpotHold(query)} returning id`);
  if (rows.length !== 1) {
    throw new Error(`The spot hold ${spotHoldId} was not active: the entry is rolled back.`);
  }
}

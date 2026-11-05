import { sql } from 'drizzle-orm';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import { spotFits } from '../../domain/allocation/chooseSpotFor.ts';
import { usableSpotHold, type UsableSpotHoldQuery } from './activeSpotHold.ts';
import type { Transaction } from './database.ts';
import { ASSIGNED_TO_ENTRY, transitionSpot, type AssignedSpotRow } from './spotClaim.ts';

type Executor = Pick<Transaction, 'execute'>;

interface HeldSpotRow extends Record<string, unknown> {
  readonly hold_id: string;
  readonly spot_id: string;
  readonly is_ev: boolean;
  readonly is_accessible: boolean;
  readonly is_oversize: boolean;
}

// Needs the lot lock. The driver's usable hold becomes her assigned spot only if the spot still fits her vehicle;
// otherwise the hold stays active and the caller claims a fitting spot (decision 016).
export async function consumeSpotHold(tx: Executor, query: UsableSpotHoldQuery, needs: VehicleNeeds): Promise<AssignedSpotRow | undefined> {
  const held = await readHeldSpot(tx, query);
  if (held === undefined || !spotFits(needs, { isEv: held.is_ev, isAccessible: held.is_accessible, isOversize: held.is_oversize })) {
    return undefined;
  }
  await markSpotHoldUsed(tx, held.hold_id, query);
  const assigned = await transitionSpot(tx, { spotId: held.spot_id, from: 'HELD', target: ASSIGNED_TO_ENTRY });
  if (assigned === undefined) {
    throw new Error(`The held spot ${held.spot_id} of a used hold was not held: the entry is rolled back.`);
  }
  return assigned;
}

async function readHeldSpot(tx: Executor, query: UsableSpotHoldQuery): Promise<HeldSpotRow | undefined> {
  const rows = await tx.execute<HeldSpotRow>(sql`
    select h.id as hold_id, h.spot_id, s.is_ev, s.is_accessible, s.is_oversize
    from (select id, spot_id from spot_hold where ${usableSpotHold(query)}) h
    join spot s on s.id = h.spot_id`);
  return rows[0];
}

async function markSpotHoldUsed(tx: Executor, spotHoldId: string, query: UsableSpotHoldQuery): Promise<void> {
  const rows = await tx.execute(sql`
    update spot_hold set status = 'USED' where id = ${spotHoldId} and ${usableSpotHold(query)} returning id`);
  if (rows.length !== 1) {
    throw new Error(`The spot hold ${spotHoldId} was not active: the entry is rolled back.`);
  }
}

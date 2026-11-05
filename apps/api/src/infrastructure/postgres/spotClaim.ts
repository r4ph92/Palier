import { sql, type SQL } from 'drizzle-orm';
import type { FreeSpot } from '../../domain/allocation/chooseSpot.ts';
import { chooseSpotFor } from '../../domain/allocation/chooseSpotFor.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { Database, Transaction } from './database.ts';
import type { SpotState } from './lotSchema.ts';
import type { SpotLabelRow } from './spotLabel.ts';

// The state a claimed spot moves to, and the instant recorded for that change.
export interface SpotClaimTarget {
  readonly state: Extract<SpotState, 'ASSIGNED' | 'HELD'>;
  readonly changedAt: SQL;
}

// An entry keeps the database clock, like the rest of its steps (decision 013).
export const ASSIGNED_TO_ENTRY: SpotClaimTarget = { state: 'ASSIGNED', changedAt: sql`now()` };

// A hold records the API's clock reading of its request (decision 016).
export function heldSince(createdAt: Date): SpotClaimTarget {
  return { state: 'HELD', changedAt: sql`${createdAt.toISOString()}::timestamptz` };
}

export interface AssignedSpotRow extends SpotLabelRow {
  readonly id: string;
}

interface FreeSpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly number: string;
  readonly level_order: number;
  readonly aisle_code: string;
  readonly distance_to_exit: number;
  readonly needs_check: boolean;
  readonly is_ev: boolean;
  readonly is_accessible: boolean;
  readonly is_oversize: boolean;
}

// Only the chosen spot is locked, and a spot another writer holds is skipped rather than waited on (docs/03).
export interface SpotClaim {
  readonly lotId: string;
  readonly needs: VehicleNeeds;
  readonly target: SpotClaimTarget;
}

export async function claimFirstFittingSpot(tx: Pick<Transaction, 'execute'>, { lotId, needs, target }: SpotClaim): Promise<AssignedSpotRow | undefined> {
  let candidates = await readFreeSpots(tx, lotId);
  let chosen = chooseSpotFor(needs, candidates);
  while (chosen !== null) {
    const claimed = await claimSpot(tx, chosen.id, target);
    if (claimed !== undefined) {
      return claimed;
    }
    const lostId = chosen.id;
    candidates = candidates.filter((candidate) => candidate.id !== lostId);
    chosen = chooseSpotFor(needs, candidates);
  }
  return undefined;
}

export async function readFreeSpots(executor: Pick<Database, 'execute'>, lotId: string): Promise<FreeSpot[]> {
  const rows = await executor.execute<FreeSpotRow>(sql`
    select s.id, s.number, l.display_order as level_order, a.code as aisle_code, s.distance_to_exit, s.needs_check,
      s.is_ev, s.is_accessible, s.is_oversize
    from spot s
    join aisle a on a.id = s.aisle_id
    join level l on l.id = a.level_id
    where s.lot_id = ${lotId} and s.state = 'AVAILABLE'`);
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    levelOrder: row.level_order,
    aisleCode: row.aisle_code,
    distanceToExit: row.distance_to_exit,
    needsCheck: row.needs_check,
    isEv: row.is_ev,
    isAccessible: row.is_accessible,
    isOversize: row.is_oversize,
  }));
}

async function claimSpot(tx: Pick<Transaction, 'execute'>, spotId: string, target: SpotClaimTarget): Promise<AssignedSpotRow | undefined> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    with chosen as (
      select id from spot where id = ${spotId} and state = 'AVAILABLE' for update skip locked
    )
    update spot
    set state = ${target.state}::spot_state, state_changed_at = ${target.changedAt}
    from chosen, aisle, level
    where spot.id = chosen.id and aisle.id = spot.aisle_id and level.id = aisle.level_id
    returning spot.id, spot.number, aisle.code as aisle_code, level.code as level_code`);
  return rows[0];
}

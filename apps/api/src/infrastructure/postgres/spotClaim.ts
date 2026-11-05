import { sql } from 'drizzle-orm';
import type { FreeSpot } from '../../domain/allocation/chooseSpot.ts';
import { chooseSpotFor } from '../../domain/allocation/chooseSpotFor.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { Database, Transaction } from './database.ts';

export interface AssignedSpotRow extends Record<string, unknown> {
  readonly id: string;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
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

// The domain picks the spot (chooseSpotFor); only that spot row is then locked, and a spot another writer holds is
// skipped rather than waited on (docs/03). Each lost spot leaves the candidates, so the attempts end with the free spots.
export async function assignFirstFreeSpot(tx: Pick<Transaction, 'execute'>, lotId: string, needs: VehicleNeeds): Promise<AssignedSpotRow | undefined> {
  let candidates = await readFreeSpots(tx, lotId);
  let chosen = chooseSpotFor(needs, candidates);
  while (chosen !== null) {
    const claimed = await claimSpot(tx, chosen.id);
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

async function claimSpot(tx: Pick<Transaction, 'execute'>, spotId: string): Promise<AssignedSpotRow | undefined> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    with chosen as (
      select id from spot where id = ${spotId} and state = 'AVAILABLE' for update skip locked
    )
    update spot
    set state = 'ASSIGNED', state_changed_at = now()
    from chosen, aisle, level
    where spot.id = chosen.id and aisle.id = spot.aisle_id and level.id = aisle.level_id
    returning spot.id, spot.number, aisle.code as aisle_code, level.code as level_code`);
  return rows[0];
}

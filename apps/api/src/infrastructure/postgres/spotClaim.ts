import { sql, type SQL } from 'drizzle-orm';
import type { FreeSpot } from '../../domain/allocation/chooseSpot.ts';
import { chooseSpotFor } from '../../domain/allocation/chooseSpotFor.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database, Transaction } from './database.ts';
import type { SpotState } from './lotSchema.ts';
import type { SpotLabelRow } from './spotLabel.ts';

export interface SpotClaimTarget {
  readonly state: Extract<SpotState, 'ASSIGNED' | 'HELD' | 'OCCUPIED'>;
  readonly changedAt: SQL;
}

// An entry keeps the database clock, like the rest of its steps (decision 013).
export const ASSIGNED_TO_ENTRY: SpotClaimTarget = { state: 'ASSIGNED', changedAt: sql`now()` };

// A driver who found their spot taken is already in the aisles: the new spot is occupied at once, as the loop does at entry.
export const OCCUPIED_BY_REPORT: SpotClaimTarget = { state: 'OCCUPIED', changedAt: sql`now()` };

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
  readonly aisle_id: string;
  readonly aisle_code: string;
  readonly distance_to_exit: number;
  readonly needs_check: boolean;
  readonly is_ev: boolean;
  readonly is_accessible: boolean;
  readonly is_oversize: boolean;
}

export type SpotChooser = (needs: VehicleNeeds, freeSpots: readonly FreeSpot[]) => FreeSpot | null;
export type FreeSpotReader = (executor: Pick<Database, 'execute'>, lotId: string) => Promise<FreeSpot[]>;

// Only the chosen spot is locked, and a spot another writer holds is skipped rather than waited on (docs/03).
export interface SpotClaim {
  readonly lotId: string;
  readonly needs: VehicleNeeds;
  readonly target: SpotClaimTarget;
  readonly choose?: SpotChooser;
  readonly readCandidates?: FreeSpotReader;
}

export async function claimFirstFittingSpot(
  tx: Pick<Transaction, 'execute'>,
  { lotId, needs, target, choose = chooseSpotFor, readCandidates = readFreeSpots }: SpotClaim,
): Promise<AssignedSpotRow | undefined> {
  let candidates = await readCandidates(tx, lotId);
  let chosen = choose(needs, candidates);
  while (chosen !== null) {
    const claimed = await transitionSpot(tx, { spotId: chosen.id, from: 'AVAILABLE', target });
    if (claimed !== undefined) {
      return claimed;
    }
    const lostId = chosen.id;
    candidates = candidates.filter((candidate) => candidate.id !== lostId);
    chosen = choose(needs, candidates);
  }
  return undefined;
}

export function readFreeSpots(executor: Pick<Database, 'execute'>, lotId: string): Promise<FreeSpot[]> {
  return readFreeSpotsWhere(executor, lotId, sql.empty());
}

// An operator may set AVAILABLE a spot an active session still holds as assigned or confirmed; claiming it would break the
// one-session-per-spot indexes. Entries keep the plain read, which the lot lock and the spot states already guard.
export function readFreeSpotsNoSessionHolds(executor: Pick<Database, 'execute'>, lotId: string): Promise<FreeSpot[]> {
  return readFreeSpotsWhere(
    executor,
    lotId,
    sql` and not exists (
      select 1 from parking_session holder
      where (holder.assigned_spot_id = s.id or holder.confirmed_spot_id = s.id) and holder.${ACTIVE_SESSION}
    )`,
  );
}

async function readFreeSpotsWhere(executor: Pick<Database, 'execute'>, lotId: string, condition: SQL): Promise<FreeSpot[]> {
  const rows = await executor.execute<FreeSpotRow>(sql`
    select s.id, s.number, l.display_order as level_order, s.aisle_id, a.code as aisle_code, s.distance_to_exit, s.needs_check,
      s.is_ev, s.is_accessible, s.is_oversize
    from spot s
    join aisle a on a.id = s.aisle_id
    join level l on l.id = a.level_id
    where s.lot_id = ${lotId} and s.state = 'AVAILABLE'${condition}`);
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    levelOrder: row.level_order,
    aisleId: row.aisle_id,
    aisleCode: row.aisle_code,
    distanceToExit: row.distance_to_exit,
    needsCheck: row.needs_check,
    ...spotFlagsOf(row),
  }));
}

export interface SpotFlagsRow {
  readonly is_ev: boolean;
  readonly is_accessible: boolean;
  readonly is_oversize: boolean;
}

export function spotFlagsOf(row: SpotFlagsRow): Pick<FreeSpot, 'isEv' | 'isAccessible' | 'isOversize'> {
  return { isEv: row.is_ev, isAccessible: row.is_accessible, isOversize: row.is_oversize };
}

export interface SpotTransition {
  readonly spotId: string;
  readonly from: Extract<SpotState, 'AVAILABLE' | 'HELD'>;
  readonly target: SpotClaimTarget;
}

// Undefined when the spot is no longer in the state it was read in, or another writer holds its row.
// `from` is inlined from a closed union, so the statement text names the state it moves from.
export async function transitionSpot(tx: Pick<Transaction, 'execute'>, { spotId, from, target }: SpotTransition): Promise<AssignedSpotRow | undefined> {
  const rows = await tx.execute<AssignedSpotRow>(sql`
    with chosen as (
      select id from spot where id = ${spotId} and state = ${sql.raw(`'${from}'`)} for update skip locked
    )
    update spot
    set state = ${target.state}::spot_state, state_changed_at = ${target.changedAt}
    from chosen, aisle, level
    where spot.id = chosen.id and aisle.id = spot.aisle_id and level.id = aisle.level_id
    returning spot.id, spot.number, aisle.code as aisle_code, level.code as level_code`);
  return rows[0];
}

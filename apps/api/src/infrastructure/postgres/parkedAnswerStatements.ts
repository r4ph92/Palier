import { sql } from 'drizzle-orm';
import type { AssignedSpot, EntrySessionState, SpotCheckReason } from '@palier/shared-types';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { SpotAnswer } from '../../domain/parkingSessions/ParkedAnswer.ts';
import { paintedNumberNamed } from '../../domain/spots/paintedSpotNumber.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import { canonicalNumberOf } from './canonicalNumberSql.ts';
import type { Database, Transaction } from './database.ts';
import { requireUpdatedRow } from './requireUpdatedRow.ts';
import { liveSpot } from './liveSpot.ts';
import { spot } from './lotSchema.ts';
import { spotOf, type SpotLabelRow } from './spotLabel.ts';

type Executor = Pick<Transaction, 'execute'>;

export interface AnsweringSession {
  readonly state: EntrySessionState;
  readonly assignedSpot: { readonly id: string; readonly state: SpotState };
  readonly confirmedSpot: AssignedSpot | null;
}

export interface AnsweredSpot {
  readonly id: string;
  readonly state: SpotState;
  readonly label: AssignedSpot;
}

interface SessionLotRow extends Record<string, unknown> {
  readonly lot_id: string;
}

interface AnsweringSessionRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly assigned_spot_id: string;
  readonly assigned_spot_state: SpotState;
  readonly number: string | null;
  readonly aisle_code: string | null;
  readonly level_code: string | null;
}

interface AnsweredSpotRow extends SpotLabelRow {
  readonly id: string;
  readonly state: SpotState;
}

// Read before the lock, to know which lot to lock; a session never changes lot.
export async function readSessionLot(database: Database, { sessionId, driverId }: Pick<SpotAnswer, 'sessionId' | 'driverId'>): Promise<string | null> {
  const [row] = await database.execute<SessionLotRow>(sql`select lot_id from parking_session where id = ${sessionId} and user_id = ${driverId}`);
  return row?.lot_id ?? null;
}

export async function lockAnsweringSession(tx: Executor, { sessionId, driverId }: SpotAnswer): Promise<AnsweringSession | null> {
  const [row] = await tx.execute<AnsweringSessionRow>(sql`
    select ps.state, ps.assigned_spot_id, assigned.state as assigned_spot_state, spot.number, aisle.code as aisle_code, level.code as level_code
    from parking_session ps
    join spot assigned on assigned.id = ps.assigned_spot_id
    left join spot on spot.id = ps.confirmed_spot_id
    left join aisle on aisle.id = spot.aisle_id
    left join level on level.id = aisle.level_id
    where ps.id = ${sessionId} and ps.user_id = ${driverId}
    for update of ps, assigned`);
  if (row === undefined) {
    return null;
  }
  const { number, aisle_code, level_code } = row;
  const confirmedSpot = number === null || aisle_code === null || level_code === null ? null : spotOf({ number, aisle_code, level_code });
  return { state: row.state, assignedSpot: { id: row.assigned_spot_id, state: row.assigned_spot_state }, confirmedSpot };
}

export interface SpotNumberInLot {
  readonly lotId: string;
  readonly spotNumber: string;
}

// The number is looked up among the live spots of the session's lot only: another lot's « C-1 », or a retired one, is unknown here.
// Painted numbers have no fixed shape (« P1-12 », « B-7a »), so every spot equal without case, spaces or dashes is locked, then one is named.
export async function lockAnsweredSpot(tx: Executor, { lotId, spotNumber }: SpotNumberInLot): Promise<AnsweredSpot | null> {
  const rows = await tx.execute<AnsweredSpotRow>(sql`
    select spot.id, spot.state, spot.number, aisle.code as aisle_code, level.code as level_code
    from spot
    join aisle on aisle.id = spot.aisle_id
    join level on level.id = aisle.level_id
    where spot.lot_id = ${lotId} and ${liveSpot()} and ${canonicalNumberOf(spot.number)} = ${canonicalSpotNumber(spotNumber)}
    order by spot.number
    for update of spot`);
  const named = paintedNumberNamed(rows.map(({ number }) => number), spotNumber);
  const row = rows.find(({ number }) => number === named);
  return row === undefined ? null : { id: row.id, state: row.state, label: spotOf(row) };
}

// The state was read under the lock just before: a zero-row update is a broken invariant, and rolls the answer back.
export async function occupyAnsweredSpot(tx: Executor, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update spot set state = 'OCCUPIED', needs_check = false, needs_check_since = null, needs_check_reason = null, state_changed_at = now()
    where id = ${spotId} and state in ('AVAILABLE', 'OCCUPIED_UNKNOWN')
    returning id`);
  requireUpdatedRow(rows, `Answered spot ${spotId} could not be occupied.`);
}

// The session is locked and still asked or presumed: a zero-row update is a broken invariant, and rolls the answer back.
export async function confirmParkedSpot(tx: Executor, sessionId: string, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set state = 'PARKED_CONFIRMED', confirmed_spot_id = ${spotId}, parked_answered_at = now()
    where id = ${sessionId} and state in ('PARKED_UNCONFIRMED', 'PARKED_PRESUMED')
    returning id`);
  requireUpdatedRow(rows, `Session ${sessionId} was no longer waiting for its answer.`);
}

// The loop confirmation made the spot OCCUPIED, and a correction flags it only after reading it OCCUPIED under its row lock;
// any other state is a broken invariant, and rolls the session back.
// A spot flagged already keeps the time and reason of its first flag, so the oldest stays first in the list.
export async function flagAssignedSpotToCheck(tx: Executor, spotId: string, reason: SpotCheckReason): Promise<void> {
  const rows = await tx.execute(sql`
    update spot set state = 'OCCUPIED_UNKNOWN', needs_check = true, needs_check_since = coalesce(needs_check_since, now()), needs_check_reason = coalesce(needs_check_reason, ${reason}), state_changed_at = now()
    where id = ${spotId} and state = 'OCCUPIED'
    returning id`);
  requireUpdatedRow(rows, `Assigned spot ${spotId} of a session leaving it was not occupied.`);
}

import { sql } from 'drizzle-orm';
import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { SpotAnswer } from '../../domain/parkingSessions/ParkedAnswer.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import type { Database, Transaction } from './database.ts';
import { spotOf, type SpotLabelRow } from './spotLabel.ts';

type Executor = Pick<Transaction, 'execute'>;

export interface AnsweringSession {
  readonly state: EntrySessionState;
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
  readonly number: string | null;
  readonly aisle_code: string | null;
  readonly level_code: string | null;
}

interface AnsweredSpotRow extends SpotLabelRow {
  readonly id: string;
  readonly state: SpotState;
}

// Read before the lock, to know which lot to lock; a session never changes lot.
export async function readSessionLot(database: Database, { sessionId, driverId }: SpotAnswer): Promise<string | null> {
  const [row] = await database.execute<SessionLotRow>(sql`select lot_id from parking_session where id = ${sessionId} and user_id = ${driverId}`);
  return row?.lot_id ?? null;
}

export async function lockAnsweringSession(tx: Executor, { sessionId, driverId }: SpotAnswer): Promise<AnsweringSession | null> {
  const [row] = await tx.execute<AnsweringSessionRow>(sql`
    select ps.state, spot.number, aisle.code as aisle_code, level.code as level_code
    from parking_session ps
    left join spot on spot.id = ps.confirmed_spot_id
    left join aisle on aisle.id = spot.aisle_id
    left join level on level.id = aisle.level_id
    where ps.id = ${sessionId} and ps.user_id = ${driverId}
    for update of ps`);
  if (row === undefined) {
    return null;
  }
  const { number, aisle_code, level_code } = row;
  const confirmedSpot = number === null || aisle_code === null || level_code === null ? null : spotOf({ number, aisle_code, level_code });
  return { state: row.state, confirmedSpot };
}

export interface SpotNumberInLot {
  readonly lotId: string;
  readonly spotNumber: string;
}

// The number is looked up in the session's lot only: another lot's « C-1 » is unknown here. Painted numbers have no
// fixed shape (« P1-12 », « B-7a »), so they are compared without case, spaces or dashes, an exact match first.
export async function lockAnsweredSpot(tx: Executor, { lotId, spotNumber }: SpotNumberInLot): Promise<AnsweredSpot | null> {
  const [row] = await tx.execute<AnsweredSpotRow>(sql`
    select spot.id, spot.state, spot.number, aisle.code as aisle_code, level.code as level_code
    from spot
    join aisle on aisle.id = spot.aisle_id
    join level on level.id = aisle.level_id
    where spot.lot_id = ${lotId} and upper(regexp_replace(spot.number, '[[:space:]–—-]', '', 'g')) = ${canonicalSpotNumber(spotNumber)}
    order by spot.number = ${spotNumber} desc, spot.number
    limit 1
    for update of spot`);
  return row === undefined ? null : { id: row.id, state: row.state, label: spotOf(row) };
}

// The state was read under the lock just before: a zero-row update is a broken invariant, and rolls the answer back.
export async function occupyAnsweredSpot(tx: Executor, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update spot set state = 'OCCUPIED', needs_check = false, state_changed_at = now()
    where id = ${spotId} and state in ('AVAILABLE', 'OCCUPIED_UNKNOWN')
    returning id`);
  if (rows.length === 0) {
    throw new Error(`Answered spot ${spotId} could not be occupied.`);
  }
}

export async function confirmParkedSpot(tx: Executor, sessionId: string, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set state = 'PARKED_CONFIRMED', confirmed_spot_id = ${spotId}, parked_answered_at = now()
    where id = ${sessionId} and state = 'PARKED_UNCONFIRMED'
    returning id`);
  if (rows.length === 0) {
    throw new Error(`Session ${sessionId} was no longer waiting for its answer.`);
  }
}

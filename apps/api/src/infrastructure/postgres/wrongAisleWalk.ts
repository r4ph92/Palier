import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { SessionAfterRefusal, WalkAisles, WalkingSignal } from '../../domain/parkingSessions/ParkedPresumption.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock } from './lockParkingLot.ts';

export interface WalkFacts extends SessionAfterRefusal, WalkAisles {
  readonly lotId: string;
}

interface WalkFactsRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
  readonly lot_id: string;
  readonly assigned_aisle_id: string;
  readonly detected_aisle_id: string | null;
}

interface UnconfirmedWalkRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
  readonly assigned_spot_id: string;
}

export interface WrongAisleWalk {
  readonly signal: WalkingSignal;
  readonly lotId: string;
  readonly aisleId: string;
}

// Minors are unique within a lot, so the detected aisle is looked for across every level; an exit lane is no place to park.
export async function readWalkFacts(database: Database, { sessionId, driverId, detectedAisleMinor }: WalkingSignal): Promise<WalkFacts | null> {
  const [row] = await database.execute<WalkFactsRow>(sql`
    select ps.state, ps.parked_at, ps.lot_id, spot.aisle_id as assigned_aisle_id, detected.id as detected_aisle_id
    from parking_session ps
    join spot on spot.id = ps.assigned_spot_id
    left join aisle detected on detected.lot_id = ps.lot_id and detected.beacon_minor = ${detectedAisleMinor} and detected.is_exit_lane = false
    where ps.id = ${sessionId} and ps.user_id = ${driverId}`);
  if (row === undefined) {
    return null;
  }
  const parkedAt = row.parked_at === null ? null : new Date(row.parked_at);
  return { state: row.state, parkedAt, lotId: row.lot_id, assignedAisleId: row.assigned_aisle_id, detectedAisleId: row.detected_aisle_id };
}

// Two writes under the lot lock (docs/03, sequence B): the session waits for the driver's answer, and its assigned spot is flagged to check.
export function askWhereParked(database: Database, walk: WrongAisleWalk): Promise<Date | null> {
  return inLotLock(database, walk.lotId, async (tx) => {
    const unconfirmed = await markSessionUnconfirmed(tx, walk);
    if (unconfirmed === undefined) {
      return null;
    }
    await flagAssignedSpotToCheck(tx, unconfirmed.assigned_spot_id);
    return new Date(unconfirmed.parked_at);
  });
}

// Clamped like the presumed walk (decision 019).
async function markSessionUnconfirmed(tx: Transaction, { signal, aisleId }: WrongAisleWalk): Promise<UnconfirmedWalkRow | undefined> {
  const [row] = await tx.execute<UnconfirmedWalkRow>(sql`
    update parking_session
    set state = 'PARKED_UNCONFIRMED', parked_aisle_id = ${aisleId},
      parked_at = greatest(least(${signal.detectedAt.toISOString()}::timestamptz, now()), entry_confirmed_at)
    where id = ${signal.sessionId} and user_id = ${signal.driverId} and state = 'ENTRY_CONFIRMED'
    returning parked_at, assigned_spot_id`);
  return row;
}

// The loop confirmation made the spot OCCUPIED in its own transaction; any other state is a broken invariant, and rolls the session back.
async function flagAssignedSpotToCheck(tx: Transaction, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update spot set state = 'OCCUPIED_UNKNOWN', needs_check = true, state_changed_at = now()
    where id = ${spotId} and state = 'OCCUPIED'
    returning id`);
  if (rows.length === 0) {
    throw new Error(`Assigned spot ${spotId} of a session walking away was not occupied.`);
  }
}

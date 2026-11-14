import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { DetectedAisle, SessionAfterRefusal, WalkAisles, WalkingSignal } from '../../domain/parkingSessions/ParkedPresumption.ts';
import { clampedParkedAt } from './clampedParkedAt.ts';
import type { Database, Transaction } from './database.ts';
import { inLotLock } from './lockParkingLot.ts';
import { flagAssignedSpotToCheck } from './parkedAnswerStatements.ts';
import { appendSessionEvent } from './sessionEventStatements.ts';

// assignedSpotId guards the walk's write: a spot-taken report may move the session to another spot after this read.
export interface WalkFacts extends SessionAfterRefusal, WalkAisles {
  readonly lotId: string;
  readonly assignedSpotId: string;
}

interface WalkFactsRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly parked_at: Date | string | null;
  readonly lot_id: string;
  readonly assigned_spot_id: string;
  readonly assigned_aisle_id: string;
  readonly detected_aisle_id: string | null;
  readonly detected_aisle_code: string | null;
  readonly detected_aisle_minor: number | null;
}

interface UnconfirmedWalkRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
  readonly assigned_spot_id: string;
}

export interface WrongAisleWalk {
  readonly signal: WalkingSignal;
  readonly facts: WalkFacts;
  readonly wrongAisle: DetectedAisle;
}

// Minors are unique within a lot, so the detected aisle is looked for across every level; an exit lane is no place to park.
export async function readWalkFacts(database: Database, { sessionId, driverId, detectedAisleMinor }: WalkingSignal): Promise<WalkFacts | null> {
  const [row] = await database.execute<WalkFactsRow>(sql`
    select ps.state, ps.parked_at, ps.lot_id, ps.assigned_spot_id, spot.aisle_id as assigned_aisle_id,
      detected.id as detected_aisle_id, detected.code as detected_aisle_code, detected.beacon_minor as detected_aisle_minor
    from parking_session ps
    join spot on spot.id = ps.assigned_spot_id
    left join aisle detected on detected.lot_id = ps.lot_id and detected.beacon_minor = ${detectedAisleMinor} and detected.is_exit_lane = false
    where ps.id = ${sessionId} and ps.user_id = ${driverId}`);
  return row === undefined ? null : walkFactsOf(row);
}

function walkFactsOf(row: WalkFactsRow): WalkFacts {
  return {
    state: row.state,
    parkedAt: row.parked_at === null ? null : new Date(row.parked_at),
    lotId: row.lot_id,
    assignedSpotId: row.assigned_spot_id,
    assignedAisleId: row.assigned_aisle_id,
    detectedAisle: detectedAisleOf(row),
  };
}

// The left join gives the three columns together, or none of them.
function detectedAisleOf({ detected_aisle_id, detected_aisle_code, detected_aisle_minor }: WalkFactsRow): DetectedAisle | null {
  if (detected_aisle_id === null || detected_aisle_code === null || detected_aisle_minor === null) {
    return null;
  }
  return { id: detected_aisle_id, code: detected_aisle_code, beaconMinor: detected_aisle_minor };
}

// Two writes under the lot lock (docs/03, sequence B): the session waits for the driver's answer, and its assigned spot is flagged to check.
// Null when the session left ENTRY_CONFIRMED or its spot changed since the facts were read.
export function askWhereParked(database: Database, walk: WrongAisleWalk): Promise<Date | null> {
  return inLotLock(database, walk.facts.lotId, async (tx) => {
    const unconfirmed = await markSessionUnconfirmed(tx, walk);
    if (unconfirmed === undefined) {
      return null;
    }
    await flagAssignedSpotToCheck(tx, unconfirmed.assigned_spot_id);
    await logWrongAisle(tx, walk);
    return new Date(unconfirmed.parked_at);
  });
}

// At the walking instant the session keeps, the one the driver is asked about.
async function logWrongAisle(tx: Transaction, { signal, facts, wrongAisle }: WrongAisleWalk): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId: signal.sessionId,
    lotId: facts.lotId,
    occurredAt: 'parked_at',
    event: { kind: 'AISLE_DETECTED', payload: { aisleId: wrongAisle.id, aisleCode: wrongAisle.code, beaconMinor: wrongAisle.beaconMinor, isAssignedAisle: false } },
  });
}

async function markSessionUnconfirmed(tx: Transaction, { signal, facts, wrongAisle }: WrongAisleWalk): Promise<UnconfirmedWalkRow | undefined> {
  const [row] = await tx.execute<UnconfirmedWalkRow>(sql`
    update parking_session
    set state = 'PARKED_UNCONFIRMED', parked_aisle_id = ${wrongAisle.id}, parked_at = ${clampedParkedAt(signal.detectedAt)}
    where id = ${signal.sessionId} and user_id = ${signal.driverId} and state = 'ENTRY_CONFIRMED' and assigned_spot_id = ${facts.assignedSpotId}
    returning parked_at, assigned_spot_id`);
  return row;
}

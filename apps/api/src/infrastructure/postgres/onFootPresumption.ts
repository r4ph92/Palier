import { sql, type SQL } from 'drizzle-orm';
import type { DetectedAisle, WalkingSignal } from '../../domain/parkingSessions/ParkedPresumption.ts';
import type { AisleDetectedPayload } from '../../domain/sessionEvents/SessionEvent.ts';
import { clampedParkedAt } from './clampedParkedAt.ts';
import type { Database } from './database.ts';
import { insertSessionEvents, presumedOnJoinedSpot, type SessionEventColumns } from './sessionEventStatements.ts';

// assignedSpotId: the spot the walk's facts were read with, null for a walk without an aisle, whose facts are not read.
// assignedAisleSeen: the spot's own aisle when the device saw it, logged before the presumption.
export interface OnFootPresumption {
  readonly signal: WalkingSignal;
  readonly assignedSpotId: string | null;
  readonly assignedAisleSeen: DetectedAisle | null;
}

interface ParkedAtRow extends Record<string, unknown> {
  readonly parked_at: Date | string;
}

const WALK_EVENT_ROW: SessionEventColumns = {
  sessionId: sql`presumed.id`,
  lotId: sql`presumed.lot_id`,
  kind: sql`walk_event.kind`,
  payload: sql`walk_event.payload`,
  occurredAt: sql`presumed.parked_at`,
};

// One statement, still without a lot lock (decision 019): the session and its events are written together or not at all.
// The events come from one ordered insert, so the sequence puts the aisle before the presumption at the same instant.
export async function presumeOnFoot(database: Database, presumption: OnFootPresumption): Promise<Date | null> {
  const [row] = await database.execute<ParkedAtRow>(sql`
    with presumed as (${presumeSession(presumption)})
    ${insertSessionEvents(WALK_EVENT_ROW, sql`
      from presumed
      join spot on spot.id = presumed.assigned_spot_id
      cross join lateral (values ${sql.join(walkEvents(presumption.assignedAisleSeen), sql`, `)}) as walk_event(ordinal, kind, payload)
      order by walk_event.ordinal
      returning occurred_at as parked_at`)}`);
  return row === undefined ? null : new Date(row.parked_at);
}

function presumeSession({ signal, assignedSpotId }: OnFootPresumption): SQL {
  const sameSpot = assignedSpotId === null ? sql.empty() : sql` and assigned_spot_id = ${assignedSpotId}`;
  return sql`
    update parking_session
    set state = 'PARKED_PRESUMED', presumed_by = 'WALK', parked_at = ${clampedParkedAt(signal.detectedAt)}
    where id = ${signal.sessionId} and user_id = ${signal.driverId} and state = 'ENTRY_CONFIRMED'${sameSpot}
    returning id, lot_id, assigned_spot_id, parked_at`;
}

function walkEvents(assignedAisleSeen: DetectedAisle | null): SQL[] {
  const presumed = sql`(2, 'PARKING_PRESUMED', ${presumedOnJoinedSpot('ON_FOOT')})`;
  if (assignedAisleSeen === null) {
    return [presumed];
  }
  const detected: AisleDetectedPayload = { aisleId: assignedAisleSeen.id, aisleCode: assignedAisleSeen.code, beaconMinor: assignedAisleSeen.beaconMinor, isAssignedAisle: true };
  return [sql`(1, 'AISLE_DETECTED', ${JSON.stringify(detected)}::jsonb)`, presumed];
}

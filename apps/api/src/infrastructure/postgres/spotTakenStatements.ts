import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { SpotTakenReport } from '../../domain/parkingSessions/SpotTakenReport.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { Transaction } from './database.ts';

type Executor = Pick<Transaction, 'execute'>;
type SessionOfDriver = Pick<SpotTakenReport, 'sessionId' | 'driverId'>;

export interface ReportingSession {
  readonly state: EntrySessionState;
  readonly assignedSpot: { readonly id: string; readonly number: string; readonly state: SpotState; readonly aisleId: string };
  readonly needs: VehicleNeeds;
}

interface ReportingSessionRow extends Record<string, unknown> {
  readonly state: EntrySessionState;
  readonly assigned_spot_id: string;
  readonly assigned_spot_number: string;
  readonly assigned_spot_state: SpotState;
  readonly assigned_aisle_id: string;
  readonly is_electric: boolean;
  readonly has_accessible_permit: boolean;
  readonly is_oversize: boolean;
}

// A session whose vehicle was deleted keeps standard needs, as an entry without a vehicle would have.
export async function lockReportingSession(tx: Executor, { sessionId, driverId }: SessionOfDriver): Promise<ReportingSession | null> {
  const [row] = await tx.execute<ReportingSessionRow>(sql`
    select ps.state, ps.assigned_spot_id, assigned.number as assigned_spot_number, assigned.state as assigned_spot_state,
      assigned.aisle_id as assigned_aisle_id, coalesce(vehicle.is_electric, false) as is_electric,
      coalesce(vehicle.has_accessible_permit, false) as has_accessible_permit, coalesce(vehicle.is_oversize, false) as is_oversize
    from parking_session ps
    join spot assigned on assigned.id = ps.assigned_spot_id
    left join vehicle on vehicle.id = ps.vehicle_id
    where ps.id = ${sessionId} and ps.user_id = ${driverId}
    for update of ps, assigned`);
  return row === undefined ? null : reportingSessionOf(row);
}

function reportingSessionOf(row: ReportingSessionRow): ReportingSession {
  return {
    state: row.state,
    assignedSpot: { id: row.assigned_spot_id, number: row.assigned_spot_number, state: row.assigned_spot_state, aisleId: row.assigned_aisle_id },
    needs: { isElectric: row.is_electric, hasAccessiblePermit: row.has_accessible_permit, isOversize: row.is_oversize },
  };
}

export interface ReportedSpot {
  readonly sessionId: string;
  readonly spotId: string;
  readonly lotId: string;
}

// A spot reported twice by the same session stays one row with its first report time.
export async function recordReportedSpot(tx: Executor, { sessionId, spotId, lotId }: ReportedSpot): Promise<void> {
  await tx.execute(sql`
    insert into parking_session_reported_spot (session_id, spot_id, lot_id) values (${sessionId}, ${spotId}, ${lotId})
    on conflict do nothing`);
}

// The session is locked and read ENTRY_CONFIRMED just before: a zero-row update is a broken invariant, and rolls the report back.
export async function reassignSession(tx: Executor, sessionId: string, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set assigned_spot_id = ${spotId}
    where id = ${sessionId} and state = 'ENTRY_CONFIRMED'
    returning id`);
  if (rows.length === 0) {
    throw new Error(`Session ${sessionId} was no longer waiting to park.`);
  }
}

// No other spot fits: the driver parks where they can and says where, the #21 question in the reported spot's aisle.
export async function askWhereParkedAfterReport(tx: Executor, sessionId: string, aisleId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set state = 'PARKED_UNCONFIRMED', parked_aisle_id = ${aisleId}, parked_at = now()
    where id = ${sessionId} and state = 'ENTRY_CONFIRMED'
    returning id`);
  if (rows.length === 0) {
    throw new Error(`Session ${sessionId} was no longer waiting to park.`);
  }
}

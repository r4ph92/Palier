import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { SpotTakenReport } from '../../domain/parkingSessions/SpotTakenReport.ts';
import type { SpotState } from '../../domain/spots/spotStates.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { Transaction } from './database.ts';
import { requireUpdatedRow } from './requireUpdatedRow.ts';
import { vehicleNeedsColumns, vehicleNeedsOf, type VehicleNeedsRow } from './spotClaim.ts';

type Executor = Pick<Transaction, 'execute'>;
type SessionOfDriver = Pick<SpotTakenReport, 'sessionId' | 'driverId'>;

export interface ReportingSession {
  readonly state: EntrySessionState;
  readonly assignedSpot: { readonly id: string; readonly number: string; readonly state: SpotState; readonly aisleId: string };
  readonly needs: VehicleNeeds;
}

interface ReportingSessionRow extends Record<string, unknown>, VehicleNeedsRow {
  readonly state: EntrySessionState;
  readonly assigned_spot_id: string;
  readonly assigned_spot_number: string;
  readonly assigned_spot_state: SpotState;
  readonly assigned_aisle_id: string;
}

export async function lockReportingSession(tx: Executor, { sessionId, driverId }: SessionOfDriver): Promise<ReportingSession | null> {
  const [row] = await tx.execute<ReportingSessionRow>(sql`
    select ps.state, ps.assigned_spot_id, assigned.number as assigned_spot_number, assigned.state as assigned_spot_state,
      assigned.aisle_id as assigned_aisle_id, ${vehicleNeedsColumns}
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
    needs: vehicleNeedsOf(row),
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

export async function reassignSession(tx: Executor, sessionId: string, spotId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set assigned_spot_id = ${spotId}
    where id = ${sessionId} and state = 'ENTRY_CONFIRMED'
    returning id`);
  requireUpdatedRow(rows, `Session ${sessionId} was no longer waiting to park.`);
}

// No other spot fits: the driver parks where they can and says where, the #21 question in the reported spot's aisle.
export async function askWhereParkedAfterReport(tx: Executor, sessionId: string, aisleId: string): Promise<void> {
  const rows = await tx.execute(sql`
    update parking_session set state = 'PARKED_UNCONFIRMED', parked_aisle_id = ${aisleId}, parked_at = now()
    where id = ${sessionId} and state = 'ENTRY_CONFIRMED'
    returning id`);
  requireUpdatedRow(rows, `Session ${sessionId} was no longer waiting to park.`);
}

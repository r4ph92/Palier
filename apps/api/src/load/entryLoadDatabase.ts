import { sql } from 'drizzle-orm';
import type { VehicleNeeds } from '../domain/vehicles/VehicleRepository.ts';
import { ACTIVE_SESSION } from '../infrastructure/postgres/activeSessionStates.ts';
import type { Database } from '../infrastructure/postgres/database.ts';
import { HELD_SPOT_COUNT } from '../infrastructure/postgres/heldSpotCount.ts';
import { readFreeSpots } from '../infrastructure/postgres/spotClaim.ts';
import { admissibleSpotCount } from './admissibleSpotCount.ts';

export interface SessionCheck {
  readonly sessions: number;
  readonly distinctSpots: number;
  readonly distinctIntents: number;
  readonly doubleBookedSpots: number;
}

export interface RunScope {
  readonly lotId: string;
  readonly driverIds: readonly string[];
  // The database's own text for now(), compared back as timestamptz, so no precision is lost on the way.
  readonly since: string;
}

interface CountRow extends Record<string, unknown> {
  readonly count: number;
}

interface LotOccupancyRow extends Record<string, unknown> {
  readonly capacity: number;
  readonly vehicle_count: number;
  readonly held_spot_count: number;
}

interface SessionCheckRow extends Record<string, unknown> {
  readonly sessions: number;
  readonly distinct_spots: number;
  readonly distinct_intents: number;
}

export async function countActiveSessionsOf(database: Database, driverIds: readonly string[]): Promise<number> {
  const rows = await database.execute<CountRow>(sql`
    select count(*)::int as count from parking_session where user_id in ${driverIds} and ${ACTIVE_SESSION}`);
  return rows[0]?.count ?? 0;
}

export async function countAdmissibleSpots(database: Database, lotId: string, needs: VehicleNeeds): Promise<number> {
  const rows = await database.execute<LotOccupancyRow>(sql`
    select capacity, vehicle_count, ${HELD_SPOT_COUNT} as held_spot_count from parking_lot where id = ${lotId}`);
  const lot = rows[0];
  if (lot === undefined) {
    return 0;
  }
  const occupancy = { capacity: lot.capacity, vehicleCount: lot.vehicle_count, heldSpotCount: lot.held_spot_count };
  return admissibleSpotCount({ occupancy, freeSpots: await readFreeSpots(database, lotId), needs });
}

// The run is scoped by the database clock, so a skew between this machine and Postgres cannot drop a session.
export async function databaseNow(database: Database): Promise<string> {
  const rows = await database.execute<{ now: string }>(sql`select now()::text as now`);
  const now = rows[0]?.now;
  if (now === undefined) {
    throw new Error('The database did not answer its clock.');
  }
  return now;
}

export async function checkRunSessions(database: Database, { lotId, driverIds, since }: RunScope): Promise<SessionCheck> {
  const rows = await database.execute<SessionCheckRow>(sql`
    select count(*)::int as sessions, count(distinct assigned_spot_id)::int as distinct_spots,
      count(distinct payment_intent_id)::int as distinct_intents
    from parking_session
    where lot_id = ${lotId} and user_id in ${driverIds} and entry_scan_at >= ${since}::timestamptz and ${ACTIVE_SESSION}`);
  const row = rows[0];
  return {
    sessions: row?.sessions ?? 0,
    distinctSpots: row?.distinct_spots ?? 0,
    distinctIntents: row?.distinct_intents ?? 0,
    doubleBookedSpots: await countDoubleBookedSpots(database, lotId),
  };
}

// Lot-wide, whoever the drivers: the unique index should make it zero, the script checks the outcome rather than trusting it.
async function countDoubleBookedSpots(database: Database, lotId: string): Promise<number> {
  const rows = await database.execute<CountRow>(sql`
    select count(*)::int as count from (
      select assigned_spot_id from parking_session where lot_id = ${lotId} and ${ACTIVE_SESSION}
      group by assigned_spot_id having count(*) > 1
    ) as shared_spots`);
  return rows[0]?.count ?? 0;
}

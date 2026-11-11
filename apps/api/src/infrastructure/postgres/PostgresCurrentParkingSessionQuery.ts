import { sql } from 'drizzle-orm';
import type { ActiveEntrySessionState, ParkedQuestion } from '@palier/shared-types';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import type { StoredLevelAisle } from '../../domain/lots/levelPlanOf.ts';
import type { ActiveParkingSession, CurrentParkingSessionQuery } from '../../domain/parkingSessions/ActiveParkingSession.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database } from './database.ts';
import { LEAVABLE_STATES } from './exitableSessionSql.ts';
import { isWithinOpeningWindow } from './openingWindowSql.ts';
import { readParkedQuestion } from './parkedQuestion.ts';
import { vehicleNeedsColumns, vehicleNeedsOf, type VehicleNeedsRow } from './vehicleNeedsSql.ts';

interface CurrentSessionRow extends Record<string, unknown>, VehicleNeedsRow {
  readonly id: string;
  readonly state: ActiveEntrySessionState;
  readonly entry_scan_at: Date | string;
  readonly pricing_increment_cents: number;
  readonly pricing_increment_minutes: number;
  readonly pricing_daily_cap_cents: number;
  readonly lot_name: string;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
  readonly level_id: string;
  readonly beacon_major: number | null;
  readonly parked_aisle_id: string | null;
  readonly exit_beacon_fallback: boolean | null;
}

interface LevelAisleRow extends Record<string, unknown> {
  readonly code: string;
  readonly beacon_minor: number;
  readonly map_polygon: unknown;
}

export class PostgresCurrentParkingSessionQuery implements CurrentParkingSessionQuery {
  readonly #database: Database;
  // How fresh an exit beacon report is for the fallback to show.
  readonly #beaconWindow: OpeningWindow;

  constructor(database: Database, beaconWindow: OpeningWindow) {
    this.#database = database;
    this.#beaconWindow = beaconWindow;
  }

  // The inner select keeps the index predicate's exact text, so the per-driver partial unique index serves it.
  // The spot is the one the driver answered, once they did.
  async findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null> {
    const rows = await this.#database.execute<CurrentSessionRow>(sql`
      select ps.id, ps.state, ps.entry_scan_at, ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents,
        ps.parked_aisle_id, lot.name as lot_name, lot.beacon_major, spot.number, aisle.code as aisle_code, level.code as level_code, aisle.level_id,
        ${vehicleNeedsColumns},
        ${this.#exitBeaconFallbackColumn()}
      from (select * from parking_session where user_id = ${userId} and ${ACTIVE_SESSION}) ps
      join parking_lot lot on lot.id = ps.lot_id
      left join vehicle on vehicle.id = ps.vehicle_id
      join spot on spot.id = coalesce(ps.confirmed_spot_id, ps.assigned_spot_id)
      join aisle on aisle.id = spot.aisle_id
      join level on level.id = aisle.level_id`);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const [levelAisles, question] = await Promise.all([this.#levelAisles(row.level_id), this.#questionOf(row)]);
    return activeSessionOf(row, { levelAisles, question });
  }

  // True when this session reported the beacon and another session of its lot did too, both within the window.
  #exitBeaconFallbackColumn() {
    const fresh = isWithinOpeningWindow(sql`report.reported_at`, this.#beaconWindow);
    return sql`(
      exists (select 1 from exit_beacon_report report where report.session_id = ps.id and ${fresh})
      and (select count(*) from exit_beacon_report report join parking_session other on other.id = report.session_id
        where other.lot_id = ps.lot_id and other.state in ${LEAVABLE_STATES} and ${fresh}) >= 2
    ) as exit_beacon_fallback`;
  }

  #questionOf(row: CurrentSessionRow): Promise<ParkedQuestion | null> {
    if (row.state !== 'PARKED_UNCONFIRMED' || row.parked_aisle_id === null) {
      return Promise.resolve(null);
    }
    return readParkedQuestion(this.#database, { aisleId: row.parked_aisle_id, needs: vehicleNeedsOf(row) });
  }

  async #levelAisles(levelId: string): Promise<StoredLevelAisle[]> {
    const rows = await this.#database.execute<LevelAisleRow>(sql`
      select code, beacon_minor, map_polygon from aisle
      where level_id = ${levelId} and is_exit_lane = false
      order by code`);
    return rows.map((row) => ({ code: row.code, beaconMinor: row.beacon_minor, mapPolygon: row.map_polygon }));
  }
}

type SessionSurroundings = Pick<ActiveParkingSession, 'levelAisles' | 'question'>;

function activeSessionOf(row: CurrentSessionRow, { levelAisles, question }: SessionSurroundings): ActiveParkingSession {
  return {
    id: row.id,
    state: row.state,
    lotName: row.lot_name,
    spot: { number: row.number, levelCode: row.level_code, aisleCode: row.aisle_code },
    enteredAt: new Date(row.entry_scan_at),
    pricing: {
      incrementCents: row.pricing_increment_cents,
      incrementMinutes: row.pricing_increment_minutes,
      dailyCapCents: row.pricing_daily_cap_cents,
    },
    beaconMajor: row.beacon_major,
    exitBeaconFallback: row.exit_beacon_fallback === true,
    levelAisles,
    question,
  };
}

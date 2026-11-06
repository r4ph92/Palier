import { sql } from 'drizzle-orm';
import type { ActiveEntrySessionState, ParkedQuestion } from '@palier/shared-types';
import type { StoredLevelAisle } from '../../domain/lots/levelPlanOf.ts';
import type { ActiveParkingSession, CurrentParkingSessionQuery } from '../../domain/parkingSessions/ActiveParkingSession.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database } from './database.ts';
import { readParkedQuestion } from './parkedQuestion.ts';

interface CurrentSessionRow extends Record<string, unknown> {
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
}

interface LevelAisleRow extends Record<string, unknown> {
  readonly code: string;
  readonly beacon_minor: number;
  readonly map_polygon: unknown;
}

export class PostgresCurrentParkingSessionQuery implements CurrentParkingSessionQuery {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // The inner select keeps the index predicate's exact text, so the per-driver partial unique index serves it.
  // The spot is the one the driver answered, once they did (story #21).
  async findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null> {
    const rows = await this.#database.execute<CurrentSessionRow>(sql`
      select ps.id, ps.state, ps.entry_scan_at, ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents,
        ps.parked_aisle_id, lot.name as lot_name, lot.beacon_major, spot.number, aisle.code as aisle_code, level.code as level_code, aisle.level_id
      from (select * from parking_session where user_id = ${userId} and ${ACTIVE_SESSION}) ps
      join parking_lot lot on lot.id = ps.lot_id
      join spot on spot.id = coalesce(ps.confirmed_spot_id, ps.assigned_spot_id)
      join aisle on aisle.id = spot.aisle_id
      join level on level.id = aisle.level_id`);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return activeSessionOf(row, { levelAisles: await this.#levelAisles(row.level_id), question: await this.#questionOf(row) });
  }

  #questionOf({ state, parked_aisle_id }: CurrentSessionRow): Promise<ParkedQuestion | null> {
    if (state !== 'PARKED_UNCONFIRMED' || parked_aisle_id === null) {
      return Promise.resolve(null);
    }
    return readParkedQuestion(this.#database, parked_aisle_id);
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
    levelAisles,
    question,
  };
}

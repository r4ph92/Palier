import { sql } from 'drizzle-orm';
import type { ActiveEntrySessionState } from '@palier/shared-types';
import type { ActiveParkingSession, CurrentParkingSessionQuery } from '../../domain/parkingSessions/ActiveParkingSession.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database } from './database.ts';

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
}

export class PostgresCurrentParkingSessionQuery implements CurrentParkingSessionQuery {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // The inner select keeps the index predicate's exact text, so the per-driver partial unique index serves it.
  async findCurrentParkingSessionForUser(userId: string): Promise<ActiveParkingSession | null> {
    const rows = await this.#database.execute<CurrentSessionRow>(sql`
      select ps.id, ps.state, ps.entry_scan_at, ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents,
        lot.name as lot_name, spot.number, aisle.code as aisle_code, level.code as level_code
      from (select * from parking_session where user_id = ${userId} and ${ACTIVE_SESSION}) ps
      join parking_lot lot on lot.id = ps.lot_id
      join spot on spot.id = ps.assigned_spot_id
      join aisle on aisle.id = spot.aisle_id
      join level on level.id = aisle.level_id`);
    const row = rows[0];
    return row === undefined ? null : activeSessionOf(row);
  }
}

function activeSessionOf(row: CurrentSessionRow): ActiveParkingSession {
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
  };
}

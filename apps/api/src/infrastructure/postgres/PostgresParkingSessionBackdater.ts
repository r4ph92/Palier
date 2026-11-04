import { sql } from 'drizzle-orm';
import type { ParkingSessionBackdater } from '../../domain/parkingSessions/ParkingSessionBackdater.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database } from './database.ts';

export class PostgresParkingSessionBackdater implements ParkingSessionBackdater {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  // Every right-hand side reads the row before the update, so the confirmation moves by the old scan's delta.
  async backdateEntry(sessionId: string, enteredAt: Date): Promise<boolean> {
    const instant = enteredAt.toISOString();
    const rows = await this.#database.execute(sql`
      update parking_session
      set entry_confirmed_at = entry_confirmed_at + (${instant}::timestamptz - entry_scan_at),
        entry_scan_at = ${instant}::timestamptz
      where id = ${sessionId} and ${ACTIVE_SESSION}
      returning id`);
    return rows.length > 0;
  }
}

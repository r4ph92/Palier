import { sql, type SQL } from 'drizzle-orm';
import type { ParkingSessionBackdater } from '../../domain/parkingSessions/ParkingSessionBackdater.ts';
import { ACTIVE_SESSION } from './activeSessionStates.ts';
import type { Database } from './database.ts';

export class PostgresParkingSessionBackdater implements ParkingSessionBackdater {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async backdateEntry(sessionId: string, enteredAt: Date): Promise<boolean> {
    const rows = await this.#database.execute(backdateStatement(sessionId, enteredAt));
    return rows.length > 0;
  }
}

// One statement: the delta is read from the locked row before any write, then moves the session's instants and its logged events alike,
// so the log keeps its order and its 2160 h purge rule. A gate command, an answer or a cancellation keeps its own instant (decision 037).
// The delta is elapsed seconds: a difference in days would add calendar days, an hour off across a daylight saving change.
function backdateStatement(sessionId: string, enteredAt: Date): SQL {
  const instant = sql`${enteredAt.toISOString()}::timestamptz`;
  return sql`
    with previous as (
      select id, make_interval(secs => extract(epoch from ${instant} - entry_scan_at)) as delta from parking_session where id = ${sessionId} and ${ACTIVE_SESSION} for update
    ), backdated as (
      update parking_session
      set entry_confirmed_at = entry_confirmed_at + previous.delta, parked_at = parked_at + previous.delta, entry_scan_at = ${instant}
      from previous where parking_session.id = previous.id
      returning parking_session.id, previous.delta
    ), shifted_events as (
      update event_log set occurred_at = occurred_at + backdated.delta, purge_after = purge_after + backdated.delta
      from backdated where event_log.session_id = backdated.id
    )
    select id from backdated`;
}

import { sql } from 'drizzle-orm';
import type { ExpiredEntry, PendingRelease, UnconfirmedEntryRepository } from '../../domain/entries/UnconfirmedEntryRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database } from './database.ts';
import { isWithinOpeningWindow } from './openingWindowSql.ts';

interface ExpiredEntryRow extends Record<string, unknown> {
  readonly id: string;
  readonly lot_id: string;
}

interface PendingReleaseRow extends Record<string, unknown> {
  readonly id: string;
  readonly payment_intent_id: string;
}

interface PendingCountRow extends Record<string, unknown> {
  readonly pending: number;
}

// The opening is the barrier command; a session without one (a crash between the spot and the command) is judged from its scan.
const OPENED_AT = sql`coalesce((select max(c.issued_at) from gate_command c where c.session_id = s.id and c.kind = 'OPEN'), s.entry_scan_at)`;

export class PostgresUnconfirmedEntryRepository implements UnconfirmedEntryRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findExpired(window: OpeningWindow): Promise<readonly ExpiredEntry[]> {
    const rows = await this.#database.execute<ExpiredEntryRow>(sql`
      select s.id, s.lot_id
      from parking_session s
      where s.state = 'CREATED' and not ${isWithinOpeningWindow(OPENED_AT, window)}
      order by s.entry_scan_at`);
    return rows.map((row) => ({ sessionId: row.id, lotId: row.lot_id }));
  }

  // Lot, then session, then spot: the order a loop closure takes, so a closure already queued on the lot finishes first.
  cancel(entry: ExpiredEntry): Promise<boolean> {
    return this.#database.transaction(async (tx) => {
      await tx.execute(sql`select id from parking_lot where id = ${entry.lotId} for no key update`);
      return cancelCreatedSession(tx, entry.sessionId);
    });
  }

  // Skip locked: two API instances checking at once share the batch instead of releasing the same hold twice.
  async claimPendingReleases(limit: number): Promise<readonly PendingRelease[]> {
    const rows = await this.#database.execute<PendingReleaseRow>(sql`
      update parking_session
      set hold_release_attempted_at = now()
      where id in (
        select id from parking_session
        where hold_release_pending and payment_intent_id is not null
        order by hold_release_attempted_at nulls first, id
        limit ${limit}
        for update skip locked)
      returning id, payment_intent_id`);
    return rows.map((row) => ({ sessionId: row.id, paymentIntentId: row.payment_intent_id }));
  }

  async markReleased(sessionId: string): Promise<void> {
    await this.#database.execute(sql`update parking_session set hold_release_pending = false where id = ${sessionId}`);
  }

  async countPendingReleases(): Promise<number> {
    const rows = await this.#database.execute<PendingCountRow>(sql`
      select count(*)::int as pending from parking_session where hold_release_pending`);
    return rows[0]?.pending ?? 0;
  }
}

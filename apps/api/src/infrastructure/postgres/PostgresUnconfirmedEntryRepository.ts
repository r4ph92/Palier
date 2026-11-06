import { sql } from 'drizzle-orm';
import type { ExpiredEntry, PendingRelease, UnconfirmedEntryRepository } from '../../domain/entries/UnconfirmedEntryRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { cancelCreatedSession } from './cancelCreatedSession.ts';
import type { Database } from './database.ts';
import { LOT_LOCK_TRANSACTION, lockParkingLot } from './lockParkingLot.ts';
import { entryOpenedAt, isWithinOpeningWindow } from './openingWindowSql.ts';

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

export class PostgresUnconfirmedEntryRepository implements UnconfirmedEntryRepository {
  readonly #database: Database;
  readonly #clock: Clock;

  constructor(database: Database, clock: Clock) {
    this.#database = database;
    this.#clock = clock;
  }

  async findExpired(window: OpeningWindow): Promise<readonly ExpiredEntry[]> {
    const rows = await this.#database.execute<ExpiredEntryRow>(sql`
      select s.id, s.lot_id
      from parking_session s
      where s.state = 'CREATED' and not ${isWithinOpeningWindow(entryOpenedAt('s'), window)}
      order by s.entry_scan_at`);
    return rows.map((row) => ({ sessionId: row.id, lotId: row.lot_id }));
  }

  // A closure already queued on the lot finishes first.
  cancel(entry: ExpiredEntry): Promise<boolean> {
    return this.#database.transaction(async (tx) => {
      await lockParkingLot(tx, entry.lotId);
      return cancelCreatedSession(tx, entry.sessionId, this.#clock());
    }, LOT_LOCK_TRANSACTION);
  }

  // Skip locked only spares waiting on a row another instance is claiming; a hold released twice is harmless, Stripe answers already canceled.
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

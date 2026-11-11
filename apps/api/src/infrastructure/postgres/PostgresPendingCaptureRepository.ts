import { sql } from 'drizzle-orm';
import type { PendingCapture, PendingCaptureRepository, SettledPayment } from '../../domain/exits/retryCaptures.ts';
import type { Database } from './database.ts';

interface PendingRow extends Record<string, unknown> {
  readonly id: string;
  readonly payment_intent_id: string;
  readonly pending_capture_cents: number;
  readonly pending_surplus_cents: number;
}

export class PostgresPendingCaptureRepository implements PendingCaptureRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listPending(limit: number): Promise<PendingCapture[]> {
    const rows = await this.#database.execute<PendingRow>(sql`
      select id, payment_intent_id, pending_capture_cents, pending_surplus_cents
      from parking_session
      where state = 'CLOSED_CAPTURE_PENDING' and payment_intent_id is not null
      order by exit_at, id
      limit ${limit}`);
    return rows.map((row) => ({ sessionId: row.id, paymentIntentId: row.payment_intent_id, amountCents: row.pending_capture_cents, surplusCents: row.pending_surplus_cents }));
  }

  // The state guard makes a second run, or a second API instance, a no-op.
  async markPaid(sessionId: string, { capturedCents, surplusPaidCents, unpaidCents }: SettledPayment): Promise<void> {
    await this.#database.execute(sql`
      update parking_session
      set state = 'CLOSED_PAID', captured_cents = ${capturedCents}, surplus_paid_cents = ${surplusPaidCents}, unpaid_cents = ${unpaidCents}
      where id = ${sessionId} and state = 'CLOSED_CAPTURE_PENDING'`);
  }
}

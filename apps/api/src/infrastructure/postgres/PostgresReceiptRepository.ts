import { sql } from 'drizzle-orm';
import type { PaidSession, ReceiptRepository } from '../../domain/receipts/ReceiptRepository.ts';
import type { Database } from './database.ts';

interface PaidSessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly lot_name: string;
  readonly entry_scan_at: Date | string;
  readonly exit_at: Date | string;
  readonly captured_cents: number;
  readonly surplus_paid_cents: number;
  readonly unpaid_cents: number;
  readonly pricing_increment_cents: number;
  readonly pricing_increment_minutes: number;
  readonly pricing_daily_cap_cents: number;
  readonly card_last4: string | null;
}

// A paid session always has its exit time and captured amount (parking_session_paid_has_exit).
const PAID_COLUMNS = sql`
  select ps.id, lot.name as lot_name, ps.entry_scan_at, ps.exit_at, ps.captured_cents, ps.surplus_paid_cents, ps.unpaid_cents,
    ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents, ps.card_last4
  from parking_session ps
  join parking_lot lot on lot.id = ps.lot_id`;

export class PostgresReceiptRepository implements ReceiptRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listPaidSessions(driverId: string): Promise<PaidSession[]> {
    const rows = await this.#database.execute<PaidSessionRow>(sql`
      ${PAID_COLUMNS}
      where ps.user_id = ${driverId} and ps.state = 'CLOSED_PAID'
      order by ps.exit_at desc, ps.id`);
    return rows.map(paidSessionOf);
  }

  async findPaidSession(sessionId: string, driverId: string): Promise<PaidSession | null> {
    const rows = await this.#database.execute<PaidSessionRow>(sql`
      ${PAID_COLUMNS}
      where ps.id = ${sessionId} and ps.user_id = ${driverId} and ps.state = 'CLOSED_PAID'`);
    const row = rows[0];
    return row === undefined ? null : paidSessionOf(row);
  }
}

function paidSessionOf(row: PaidSessionRow): PaidSession {
  return {
    id: row.id,
    lotName: row.lot_name,
    enteredAt: new Date(row.entry_scan_at),
    pricing: {
      incrementCents: row.pricing_increment_cents,
      incrementMinutes: row.pricing_increment_minutes,
      dailyCapCents: row.pricing_daily_cap_cents,
    },
    exit: { exitedAt: new Date(row.exit_at), capturedCents: row.captured_cents, surplusPaidCents: row.surplus_paid_cents, unpaidCents: row.unpaid_cents },
    cardLast4: row.card_last4,
  };
}

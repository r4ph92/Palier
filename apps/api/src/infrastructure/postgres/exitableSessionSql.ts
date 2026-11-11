import { sql } from 'drizzle-orm';
import type { EntrySessionState } from '@palier/shared-types';
import type { ExitableSession, PaidExit } from '../../domain/exits/ExitRepository.ts';

export interface ExitableRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly lot_id: string;
  readonly payment_intent_id: string | null;
  readonly authorized_cents: number;
  readonly entry_scan_at: Date | string;
  readonly pricing_increment_cents: number;
  readonly pricing_increment_minutes: number;
  readonly pricing_daily_cap_cents: number;
  readonly exit_gate_id: string | null;
  readonly exit_at: Date | string | null;
  readonly captured_cents: number | null;
  readonly surplus_paid_cents: number;
  readonly unpaid_cents: number;
}

// Sessions that went through the gate and have not left: the only ones an exit closes.
export const LEAVABLE_STATES = sql`('ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED')`;

// What every exit read takes of a session: the columns of ExitableRow.
export const EXITABLE_COLUMNS = sql.raw(`ps.id, ps.state, ps.lot_id, ps.payment_intent_id, ps.authorized_cents, ps.entry_scan_at, ps.exit_at, ps.captured_cents,
        ps.surplus_paid_cents, ps.unpaid_cents,
        ps.pricing_increment_cents, ps.pricing_increment_minutes, ps.pricing_daily_cap_cents,
        (select gate.id from gate where gate.lot_id = ps.lot_id and gate.kind = 'EXIT' order by gate.name limit 1) as exit_gate_id`);

export function exitableSessionOf(row: ExitableRow): ExitableSession {
  return {
    id: row.id,
    state: row.state,
    lotId: row.lot_id,
    paymentIntentId: row.payment_intent_id,
    authorizedCents: row.authorized_cents,
    enteredAt: new Date(row.entry_scan_at),
    pricing: {
      incrementCents: row.pricing_increment_cents,
      incrementMinutes: row.pricing_increment_minutes,
      dailyCapCents: row.pricing_daily_cap_cents,
    },
    exitGateId: row.exit_gate_id,
    paidExit: row.exit_at === null || row.captured_cents === null ? null : paidExitOf(row, row.exit_at, row.captured_cents),
  };
}

export function paidExitOf(row: { readonly surplus_paid_cents: number; readonly unpaid_cents: number }, exitAt: Date | string, capturedCents: number): PaidExit {
  return { exitedAt: new Date(exitAt), capturedCents, surplusPaidCents: row.surplus_paid_cents, unpaidCents: row.unpaid_cents };
}

import { sql } from 'drizzle-orm';
import type { ExitIdentification } from '../../domain/exits/ExitRepository.ts';
import type { SettledPayment } from '../../domain/exits/takePayment.ts';
import type { CapturePendingPayload } from '../../domain/sessionEvents/SessionEvent.ts';
import type { Transaction } from './database.ts';
import { appendSessionEvent } from './sessionEventStatements.ts';

// The exit being closed, as the close transaction knows it (decision 038).
export interface LoggedExit {
  readonly sessionId: string;
  readonly lotId: string;
  readonly exitGateId: string;
  readonly identification: ExitIdentification;
}

// The identification at the tap or the read, then the payment Stripe confirmed after it: the order they happened in.
export async function logPaidExit(tx: Transaction, exit: LoggedExit, payment: SettledPayment): Promise<void> {
  await logExitIdentified(tx, exit);
  await logCaptured(tx, exit, payment);
}

// The amounts fixed at the tap, dated by it: Stripe confirmed nothing, the retry logs the capture when it takes it.
export async function logPendingExit(tx: Transaction, exit: LoggedExit, pending: CapturePendingPayload): Promise<void> {
  await logExitIdentified(tx, exit);
  await appendSessionEvent(tx, {
    sessionId: exit.sessionId,
    lotId: exit.lotId,
    occurredAt: 'exit_at',
    event: { kind: 'CAPTURE_PENDING', payload: { pendingCaptureCents: pending.pendingCaptureCents, pendingSurplusCents: pending.pendingSurplusCents } },
  });
}

// The session reference only: the capture retry knows the session and its lot, not how it left.
export interface LoggedSession {
  readonly sessionId: string;
  readonly lotId: string;
}

// Dated by the instant Stripe confirmed the capture, which no column of the session keeps.
export async function logCaptured(tx: Transaction, { sessionId, lotId }: LoggedSession, { capturedCents, surplusPaidCents, unpaidCents, capturedAt }: SettledPayment): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId,
    lotId,
    occurredAt: sql`${capturedAt.toISOString()}::timestamptz`,
    event: { kind: 'CAPTURED', payload: { capturedCents, surplusPaidCents, unpaidCents } },
  });
}

async function logExitIdentified(tx: Transaction, { sessionId, lotId, exitGateId, identification }: LoggedExit): Promise<void> {
  await appendSessionEvent(tx, {
    sessionId,
    lotId,
    occurredAt: 'exit_at',
    event: { kind: 'EXIT_IDENTIFIED', payload: { method: identification, gateId: exitGateId } },
  });
}

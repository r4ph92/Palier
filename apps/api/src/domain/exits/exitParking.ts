import type { ExitReceipt } from '@palier/shared-types';
import type { CaptureOutcome, PaymentAuthorizer } from '../entries/PaymentAuthorizer.ts';
import { amountSoFar, elapsedMinutesBetween } from '../pricing/priceParkingSessionAt.ts';
import type { ExitableSession, ExitRepository, PaidExit } from './ExitRepository.ts';

export interface ExitRequest {
  readonly sessionId: string;
  readonly driverId: string;
  readonly now: Date;
}

export type ExitRefusal = 'not-found' | 'entry-not-confirmed' | 'closed' | 'gate-unavailable' | 'payments-unavailable' | 'lot-busy';

// left: this request took the money and opened the barrier; already: an earlier one did, and its receipt stands; capture-pending: the
// barrier is open but Stripe could not be reached, so the capture is retried and the receipt follows.
export type ExitOutcome =
  | { readonly outcome: 'left' | 'already'; readonly receipt: ExitReceipt }
  | { readonly outcome: 'capture-pending' }
  | { readonly outcome: ExitRefusal };

export interface ExitDependencies {
  readonly exits: ExitRepository;
  // Null when the server has no Stripe key: the exit then stops before it takes anything.
  readonly payments: PaymentAuthorizer | null;
}

// Capture, then close and open (docs/03, sequence C). When Stripe cannot take the capture the barrier opens anyway: the session closes
// with the capture pending and the retry takes the same amount later (decision 026).
export async function exitParking(dependencies: ExitDependencies, request: ExitRequest): Promise<ExitOutcome> {
  const session = await dependencies.exits.findForExit(request.sessionId, request.driverId);
  const refusal = refusalFor(session);
  if (session === null || refusal !== null) {
    return { outcome: refusal ?? 'not-found' };
  }
  if (session.paidExit !== null) {
    return { outcome: 'already', receipt: receiptOf(session, session.paidExit) };
  }
  if (session.state === 'CLOSED_CAPTURE_PENDING') {
    return { outcome: 'capture-pending' };
  }
  return payAndClose(dependencies, session, request.now);
}

async function payAndClose({ exits, payments }: ExitDependencies, session: ExitableSession, now: Date): Promise<ExitOutcome> {
  if (session.exitGateId === null) {
    return { outcome: 'gate-unavailable' };
  }
  if (payments === null || session.paymentIntentId === null) {
    return { outcome: 'payments-unavailable' };
  }
  const amountCents = amountToCapture(session, now);
  const captured: CaptureOutcome = await payments.capture({ sessionId: session.id, paymentIntentId: session.paymentIntentId, amountCents });
  if (captured.outcome === 'failed') {
    return leaveWithCapturePending(exits, session, { exitGateId: session.exitGateId, exitedAt: now, pendingCaptureCents: amountCents });
  }
  // What Stripe really took: after a capture whose close failed, a later tap asks another amount but the first one stands.
  return closePaid(exits, session, { exitGateId: session.exitGateId, exit: { exitedAt: now, capturedCents: captured.amountCents } });
}

interface PaidLeave {
  readonly exitGateId: string;
  readonly exit: PaidExit;
}

async function closePaid(exits: ExitRepository, session: ExitableSession, { exitGateId, exit }: PaidLeave): Promise<ExitOutcome> {
  const closed = await exits.close({ sessionId: session.id, lotId: session.lotId, exitGateId, exit });
  if (closed.outcome === 'lot-busy') {
    return closed;
  }
  // A request that lost the race gets the winner's receipt; the capture was one and the same (Stripe's idempotency key).
  if (closed.exit === null) {
    return { outcome: 'capture-pending' };
  }
  return { outcome: closed.outcome === 'closed' ? 'left' : 'already', receipt: receiptOf(session, closed.exit) };
}

interface PendingLeave {
  readonly exitGateId: string;
  readonly exitedAt: Date;
  readonly pendingCaptureCents: number;
}

// Funds are already held at entry (Q38): the driver is not kept inside for Stripe's outage.
async function leaveWithCapturePending(exits: ExitRepository, session: ExitableSession, leave: PendingLeave): Promise<ExitOutcome> {
  const closed = await exits.closeWithPendingCapture({ sessionId: session.id, lotId: session.lotId, ...leave });
  return closed.outcome === 'lot-busy' ? { outcome: 'lot-busy' } : { outcome: 'capture-pending' };
}

function refusalFor(session: ExitableSession | null): ExitRefusal | null {
  if (session === null) {
    return 'not-found';
  }
  if (session.state === 'CREATED') {
    return 'entry-not-confirmed';
  }
  return session.state === 'CANCELLED' ? 'closed' : null;
}

// The card hold is the ceiling: an exit never takes more than was authorized.
function amountToCapture(session: ExitableSession, now: Date): number {
  return Math.min(session.authorizedCents, amountSoFar(session.pricing, elapsedMinutesBetween(session.enteredAt, now)));
}

export function receiptOf(session: Pick<ExitableSession, 'enteredAt' | 'pricing'>, { exitedAt, capturedCents }: PaidExit): ExitReceipt {
  const durationMinutes = elapsedMinutesBetween(session.enteredAt, exitedAt);
  const increments = Math.max(1, Math.ceil(durationMinutes / session.pricing.incrementMinutes));
  return {
    exitedAt: exitedAt.toISOString(),
    durationMinutes,
    increments,
    incrementCents: session.pricing.incrementCents,
    totalCents: capturedCents,
    capped: capturedCents !== increments * session.pricing.incrementCents,
  };
}

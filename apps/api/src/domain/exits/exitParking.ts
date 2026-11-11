import type { ExitReceipt } from '@palier/shared-types';
import type { CaptureOutcome, PaymentAuthorizer } from '../entries/PaymentAuthorizer.ts';
import { elapsedMinutesBetween, stayAmount, stayLines } from '../pricing/priceParkingSessionAt.ts';
import type { ExitableSession, ExitIdentification, ExitRepository, PaidExit } from './ExitRepository.ts';
import { settleSurplus } from './settleSurplus.ts';

export interface ExitRequest {
  readonly sessionId: string;
  readonly driverId: string;
  readonly now: Date;
}

export type ExitRefusal = 'not-found' | 'entry-not-confirmed' | 'closed' | 'gate-unavailable' | 'payments-unavailable' | 'lot-busy';

// left: this request took the money and opened the barrier; already: an earlier one did, and its receipt stands; capture-pending: the
// barrier is open but Stripe could not be reached, so the capture and the surplus are retried and the receipt follows.
export type ExitOutcome =
  | { readonly outcome: 'left' | 'already'; readonly receipt: ExitReceipt }
  | { readonly outcome: 'capture-pending' }
  | { readonly outcome: ExitRefusal };

export interface ExitDependencies {
  readonly exits: ExitRepository;
  // Null when the server has no Stripe key: the exit then stops before it takes anything.
  readonly payments: PaymentAuthorizer | null;
}

// Capture, then close and open (docs/03, sequence C). When Stripe cannot take the capture, or cannot say whether it took the surplus, the
// barrier opens anyway: the session closes with the payment pending and the retry takes the same amounts later (decisions 026 and 027).
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
  return payAndClose(dependencies, session, { now: request.now, identification: 'APP', exitGateId: session.exitGateId });
}

// Where and how the exit happens: the tap uses the lot's exit gate, a reader the gate that read the vehicle.
export interface ExitSettings {
  readonly now: Date;
  readonly identification: ExitIdentification;
  readonly exitGateId: string | null;
}

export async function payAndClose({ exits, payments }: ExitDependencies, session: ExitableSession, { now, identification, exitGateId }: ExitSettings): Promise<ExitOutcome> {
  if (exitGateId === null) {
    return { outcome: 'gate-unavailable' };
  }
  if (payments === null || session.paymentIntentId === null) {
    return { outcome: 'payments-unavailable' };
  }
  const billedCents = stayAmount(session.pricing, elapsedMinutesBetween(session.enteredAt, now));
  const amountCents = Math.min(session.authorizedCents, billedCents);
  const captured: CaptureOutcome = await payments.capture({ sessionId: session.id, paymentIntentId: session.paymentIntentId, amountCents });
  // Only what the hold cannot cover is a surplus, however much a capture of an earlier tap already took.
  const pending = { exitGateId, identification, exitedAt: now, pendingCaptureCents: amountCents, pendingSurplusCents: billedCents - amountCents };
  // A Stripe that cannot take the capture is not asked for the surplus either: the retry charges both.
  if (captured.outcome === 'failed') {
    return leaveWithCapturePending(exits, session, pending);
  }
  const surplus = await settleSurplus(payments, { sessionId: session.id, paymentIntentId: session.paymentIntentId, amountCents: pending.pendingSurplusCents });
  // Whether the card paid the surplus is unknown: the retry replays the capture just taken and asks Stripe again.
  if (surplus === null) {
    return leaveWithCapturePending(exits, session, pending);
  }
  // What Stripe really took: after a capture whose close failed, a later tap asks another amount but the first one stands.
  return closePaid(exits, session, { exitGateId, identification, exit: { exitedAt: now, capturedCents: captured.amountCents, ...surplus } });
}

interface PaidLeave {
  readonly exitGateId: string;
  readonly identification: ExitIdentification;
  readonly exit: PaidExit;
}

async function closePaid(exits: ExitRepository, session: ExitableSession, { exitGateId, identification, exit }: PaidLeave): Promise<ExitOutcome> {
  const closed = await exits.close({ sessionId: session.id, lotId: session.lotId, exitGateId, identification, exit });
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
  readonly identification: ExitIdentification;
  readonly exitedAt: Date;
  readonly pendingCaptureCents: number;
  readonly pendingSurplusCents: number;
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

export function receiptOf(session: Pick<ExitableSession, 'enteredAt' | 'pricing'>, { exitedAt, capturedCents, surplusPaidCents, unpaidCents }: PaidExit): ExitReceipt {
  const durationMinutes = elapsedMinutesBetween(session.enteredAt, exitedAt);
  const increments = Math.max(1, Math.ceil(durationMinutes / session.pricing.incrementMinutes));
  const lines = stayLines(session.pricing, durationMinutes);
  return {
    exitedAt: exitedAt.toISOString(),
    durationMinutes,
    increments,
    incrementCents: session.pricing.incrementCents,
    totalCents: capturedCents + surplusPaidCents,
    capped: lines.length === 0 && capturedCents !== increments * session.pricing.incrementCents,
    lines,
    unpaidCents,
  };
}

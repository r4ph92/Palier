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

// left: this request took the money and opened the barrier; already: an earlier one did, and its receipt stands.
export type ExitOutcome = { readonly outcome: 'left' | 'already'; readonly receipt: ExitReceipt } | { readonly outcome: ExitRefusal };

export interface ExitDependencies {
  readonly exits: ExitRepository;
  // Null when the server has no Stripe key: the exit then stops before it takes anything.
  readonly payments: PaymentAuthorizer | null;
}

// Capture, then close and open (docs/03, sequence C). A card that cannot be charged stops the exit with the session still open
// and nothing taken: retrying the capture while the barrier opens anyway is a later story.
export async function exitParking({ exits, payments }: ExitDependencies, request: ExitRequest): Promise<ExitOutcome> {
  const session = await exits.findForExit(request.sessionId, request.driverId);
  const refusal = refusalFor(session);
  if (session === null || refusal !== null) {
    return { outcome: refusal ?? 'not-found' };
  }
  if (session.paidExit !== null) {
    return { outcome: 'already', receipt: receiptOf(session, session.paidExit) };
  }
  if (session.exitGateId === null) {
    return { outcome: 'gate-unavailable' };
  }
  if (payments === null || session.paymentIntentId === null) {
    return { outcome: 'payments-unavailable' };
  }
  const exit = { exitedAt: request.now, capturedCents: amountToCapture(session, request.now) };
  const captured: CaptureOutcome = await payments.capture({ sessionId: session.id, paymentIntentId: session.paymentIntentId, amountCents: exit.capturedCents });
  if (captured === 'failed') {
    return { outcome: 'payments-unavailable' };
  }
  const closed = await exits.close({ sessionId: session.id, lotId: session.lotId, exitGateId: session.exitGateId, exit });
  if (closed.outcome === 'lot-busy') {
    return closed;
  }
  // A request that lost the race gets the winner's receipt; the capture was one and the same (Stripe's idempotency key).
  return { outcome: closed.outcome === 'closed' ? 'left' : 'already', receipt: receiptOf(session, closed.exit) };
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

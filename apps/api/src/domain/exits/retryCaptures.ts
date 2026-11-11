import type { PaymentAuthorizer } from '../entries/PaymentAuthorizer.ts';
import type { JobLog } from '../JobLog.ts';
import { settleSurplus, type SurplusSettlement } from './settleSurplus.ts';

// A closed session whose capture Stripe could not take at the exit; the amount was fixed at the tap (decision 026).
export interface PendingCapture {
  readonly sessionId: string;
  readonly paymentIntentId: string;
  readonly amountCents: number;
  // Charged after the capture, for a stay over 24 hours; 0 when the hold covers it (decision 027).
  readonly surplusCents: number;
}

export interface SettledPayment extends SurplusSettlement {
  readonly capturedCents: number;
}

export interface PendingCaptureRepository {
  // Oldest exit first, so a long outage drains in the order the drivers left.
  listPending(limit: number): Promise<PendingCapture[]>;
  // CLOSED_CAPTURE_PENDING to CLOSED_PAID with what Stripe really took; a session no longer pending is left as it is.
  markPaid(sessionId: string, payment: SettledPayment): Promise<void>;
}

export interface CaptureRetryJob {
  readonly pending: PendingCaptureRepository;
  readonly payments: PaymentAuthorizer;
}

const BATCH_SIZE = 50;

// Each capture goes out with the amount and the idempotency key of the exit tap, so Stripe takes it once however many runs retry it; the
// surplus is looked up before it is charged, so it is taken once too. A payment that fails again waits for the next run; the others still go.
export async function retryCaptures({ pending, payments }: CaptureRetryJob, log: JobLog): Promise<void> {
  for (const { sessionId, paymentIntentId, amountCents, surplusCents } of await pending.listPending(BATCH_SIZE)) {
    const captured = await payments.capture({ sessionId, paymentIntentId, amountCents });
    if (captured.outcome === 'failed') {
      log.warn({ sessionId }, 'capture still pending, retried at the next run');
      continue;
    }
    const surplus = await settleSurplus(payments, { sessionId, paymentIntentId, amountCents: surplusCents });
    if (surplus === null) {
      log.warn({ sessionId }, 'surplus still pending, retried at the next run');
      continue;
    }
    await pending.markPaid(sessionId, { capturedCents: captured.amountCents, ...surplus });
    log.info({ sessionId }, 'pending capture taken');
  }
}

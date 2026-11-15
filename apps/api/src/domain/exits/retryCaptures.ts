import type { PaymentAuthorizer } from '../entries/PaymentAuthorizer.ts';
import type { JobLog } from '../JobLog.ts';
import type { Clock } from '../time/Clock.ts';
import { takePayment, type PaymentToTake, type SettledPayment } from './takePayment.ts';

// A closed session whose capture Stripe could not take at the exit; the amounts were fixed at the tap (decisions 026 and 027).
export type PendingCapture = PaymentToTake;

export interface PendingCaptureRepository {
  // Oldest exit first, so a long outage drains in the order the drivers left.
  listPending(limit: number): Promise<PendingCapture[]>;
  // CLOSED_CAPTURE_PENDING to CLOSED_PAID with what Stripe really took, and its event dated by capturedAt; a session no longer pending
  // is left as it is and logs nothing.
  markPaid(sessionId: string, payment: SettledPayment): Promise<void>;
}

export interface CaptureRetryJob {
  readonly pending: PendingCaptureRepository;
  readonly payments: PaymentAuthorizer;
  // Read for each session when Stripe confirms its capture, not once per run.
  readonly clock: Clock;
}

const BATCH_SIZE = 50;

const STILL_PENDING_MESSAGES = {
  'capture-failed': 'capture still pending, retried at the next run',
  'surplus-unknown': 'surplus still pending, retried at the next run',
} as const;

// Each capture goes out with the amount and the idempotency key of the exit tap, so Stripe takes it once however many runs retry it; the
// surplus is looked up before it is charged, so it is taken once too. A session that fails again waits for the next run; the others still go.
export async function retryCaptures(job: CaptureRetryJob, log: JobLog): Promise<void> {
  for (const capture of await job.pending.listPending(BATCH_SIZE)) {
    try {
      await retryCapture(job, capture, log);
    } catch {
      // The raw error can quote the session row, Stripe id included; the session id is enough to find it.
      log.error({ sessionId: capture.sessionId }, 'pending capture not settled, retried at the next run');
    }
  }
}

async function retryCapture({ pending, payments, clock }: CaptureRetryJob, capture: PendingCapture, log: JobLog): Promise<void> {
  const { sessionId } = capture;
  const taken = await takePayment(payments, clock, capture);
  if (taken.outcome !== 'paid') {
    log.warn({ sessionId }, STILL_PENDING_MESSAGES[taken.outcome]);
    return;
  }
  await pending.markPaid(sessionId, taken.payment);
  log.info({ sessionId }, 'pending capture taken');
}

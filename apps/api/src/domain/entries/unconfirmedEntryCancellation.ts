import { assertNever } from '../assertNever.ts';
import type { OpeningWindow } from '../gates/PassageLedger.ts';
import type { HoldRelease, PaymentAuthorizer } from './PaymentAuthorizer.ts';
import type { ExpiredEntry, PendingRelease, UnconfirmedEntryRepository } from './UnconfirmedEntryRepository.ts';

// Stripe answers in 2.5 s at most per attempt: five holds keep one release batch short even when Stripe is down.
export const HOLD_RELEASES_PER_CHECK = 5;

export interface CancellationJob {
  readonly entries: UnconfirmedEntryRepository;
  // Null without a Stripe key: sessions are still cancelled, their holds wait for a key.
  readonly payments: PaymentAuthorizer | null;
  readonly openingWindow: OpeningWindow;
}

export interface CancellationLog {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
  error(details: object, message: string): void;
}

interface HoldReleaseRun {
  readonly entries: UnconfirmedEntryRepository;
  readonly payments: PaymentAuthorizer;
  readonly log: CancellationLog;
}

// Never waits on Stripe: the spot is freed here, the hold is released by releasePendingHolds.
export async function cancelUnconfirmedEntries(job: CancellationJob, log: CancellationLog): Promise<void> {
  const expired = await job.entries.findExpired(job.openingWindow);
  for (const entry of expired) {
    await cancelEntry(job.entries, entry, log);
  }
}

async function cancelEntry(entries: UnconfirmedEntryRepository, entry: ExpiredEntry, log: CancellationLog): Promise<void> {
  try {
    if (await entries.cancel(entry)) {
      log.info({ sessionId: entry.sessionId }, 'cancelled an entry nobody drove through');
    }
  } catch (error) {
    log.error({ err: error, sessionId: entry.sessionId }, 'could not cancel an unconfirmed entry');
  }
}

export async function releasePendingHolds(job: CancellationJob, log: CancellationLog): Promise<void> {
  if (job.payments === null) {
    await warnHoldsWaitForStripe(job.entries, log);
    return;
  }
  const run: HoldReleaseRun = { entries: job.entries, payments: job.payments, log };
  const holds = await job.entries.claimPendingReleases(HOLD_RELEASES_PER_CHECK);
  await Promise.allSettled(holds.map((hold) => releaseHold(run, hold)));
}

async function warnHoldsWaitForStripe(entries: UnconfirmedEntryRepository, log: CancellationLog): Promise<void> {
  const pending = await entries.countPendingReleases();
  if (pending > 0) {
    log.warn({ pending }, 'card holds wait for release: the server has no Stripe key');
  }
}

async function releaseHold(run: HoldReleaseRun, hold: PendingRelease): Promise<void> {
  try {
    await settleRelease(run, hold, await run.payments.cancel(hold.paymentIntentId));
  } catch (error) {
    run.log.error({ err: error, ...hold }, 'releasing a card hold failed, retried at the next check');
  }
}

async function settleRelease({ entries, log }: HoldReleaseRun, hold: PendingRelease, release: HoldRelease): Promise<void> {
  switch (release) {
    case 'released':
      await entries.markReleased(hold.sessionId);
      log.info(hold, 'released the card hold of a cancelled entry');
      return;
    case 'gone':
      await entries.markReleased(hold.sessionId);
      log.error(hold, 'Stripe can no longer cancel this card hold, it is not retried');
      return;
    case 'failed':
      log.warn(hold, 'Stripe did not release the card hold, retried at the next check');
      return;
    default:
      assertNever(release);
  }
}

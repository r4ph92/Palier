import { describe, expect, it, vi } from 'vitest';
import { retryCaptures, type PendingCapture, type PendingCaptureRepository } from '../../src/domain/exits/retryCaptures.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';

const julie: PendingCapture = { sessionId: 'session-julie', paymentIntentId: 'pi_julie', amountCents: 2500, surplusCents: 600 };
const marc: PendingCapture = { sessionId: 'session-marc', paymentIntentId: 'pi_marc', amountCents: 300, surplusCents: 0 };
const RETRY_AT = new Date('2026-11-15T06:07:47Z');

class RecordedPayments implements PendingCaptureRepository {
  readonly paid: string[] = [];
  readonly #pending: PendingCapture[];

  constructor(pending: PendingCapture[]) {
    this.#pending = pending;
  }

  listPending(): Promise<PendingCapture[]> {
    return Promise.resolve(this.#pending);
  }

  markPaid(sessionId: string): Promise<void> {
    this.paid.push(sessionId);
    return Promise.resolve();
  }
}

function retryRun() {
  const captures = new RecordedPayments([julie, marc]);
  const payments = new FakePaymentAuthorizer();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const run = () => retryCaptures({ pending: captures, payments, clock: () => RETRY_AT }, log);
  return { captures, payments, log, run };
}

describe('the capture retry when a Stripe call throws for one session (QA #157, round 2)', () => {
  it('still settles the next session when the capture request itself throws, and logs no Stripe id', async () => {
    const { captures, payments, log, run } = retryRun();
    const capture = payments.capture.bind(payments);
    payments.capture = (request) => (request.sessionId === 'session-julie' ? Promise.reject(new Error('connect ECONNRESET pi_julie')) : capture(request));

    await run();

    expect(captures.paid).toEqual(['session-marc']);
    expect(log.error).toHaveBeenCalledWith({ sessionId: 'session-julie' }, 'pending capture not settled, retried at the next run');
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('pi_');
  });

  it('still settles the next session when the surplus charge throws after the capture went through', async () => {
    const { captures, payments, log, run } = retryRun();
    payments.chargeSurplus = () => Promise.reject(new Error('Stripe timeout on pi_julie'));

    await run();

    expect(captures.paid).toEqual(['session-marc']);
    expect(log.error).toHaveBeenCalledOnce();
  });
});

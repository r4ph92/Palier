import { describe, expect, it, vi } from 'vitest';
import { retryCaptures, type PendingCapture, type PendingCaptureRepository } from '../../src/domain/exits/retryCaptures.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';

const julie: PendingCapture = { sessionId: 'session-julie', paymentIntentId: 'pi_julie', amountCents: 975 };
const marc: PendingCapture = { sessionId: 'session-marc', paymentIntentId: 'pi_marc', amountCents: 300 };

class FakePendingCaptures implements PendingCaptureRepository {
  readonly paid: { sessionId: string; capturedCents: number }[] = [];
  #pending: PendingCapture[];

  constructor(pending: PendingCapture[]) {
    this.#pending = pending;
  }

  listPending(): Promise<PendingCapture[]> {
    return Promise.resolve(this.#pending);
  }

  markPaid(sessionId: string, capturedCents: number): Promise<void> {
    this.paid.push({ sessionId, capturedCents });
    this.#pending = this.#pending.filter((capture) => capture.sessionId !== sessionId);
    return Promise.resolve();
  }
}

function setup(pending: PendingCapture[]) {
  const captures = new FakePendingCaptures(pending);
  const payments = new FakePaymentAuthorizer();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const run = () => retryCaptures({ pending: captures, payments }, log);
  return { captures, payments, log, run };
}

describe('retryCaptures', () => {
  it('captures the amount fixed at the tap and marks the session paid', async () => {
    const { captures, payments, run } = setup([julie]);

    await run();

    expect(payments.captured).toEqual([{ sessionId: 'session-julie', paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 975 }]);
  });

  it('keeps the session pending and tries again at the next run while Stripe is unreachable', async () => {
    const { captures, payments, log, run } = setup([julie]);
    payments.captureOutcome = 'failed';

    await run();
    await run();

    expect(captures.paid).toEqual([]);
    expect(log.warn).toHaveBeenCalledTimes(2);

    payments.captureOutcome = 'captured';
    await run();
    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 975 }]);
  });

  it('captures once over several runs: a paid session is no longer listed', async () => {
    const { payments, run } = setup([julie]);

    await run();
    await run();
    await run();

    expect(payments.captured).toHaveLength(1);
  });

  it('records what Stripe really took when the capture already happened', async () => {
    const { captures, payments, run } = setup([julie]);
    payments.alreadyCapturedCents = 900;

    await run();

    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 900 }]);
  });

  it('goes on with the other sessions when one capture fails', async () => {
    const { captures, payments, run } = setup([julie, marc]);
    const capture = payments.capture.bind(payments);
    payments.capture = (request) => (request.sessionId === 'session-julie' ? Promise.resolve({ outcome: 'failed' }) : capture(request));

    await run();

    expect(captures.paid).toEqual([{ sessionId: 'session-marc', capturedCents: 300 }]);
  });
});

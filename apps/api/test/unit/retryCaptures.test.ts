import { describe, expect, it, vi } from 'vitest';
import { retryCaptures, type PendingCapture, type PendingCaptureRepository, type SettledPayment } from '../../src/domain/exits/retryCaptures.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';

const julie: PendingCapture = { sessionId: 'session-julie', paymentIntentId: 'pi_julie', amountCents: 975, surplusCents: 0 };
const marc: PendingCapture = { sessionId: 'session-marc', paymentIntentId: 'pi_marc', amountCents: 300, surplusCents: 0 };
// Left after 30 hours while Stripe was down: the 25 $ cap from the hold, 18 $ beyond it.
const sophie: PendingCapture = { sessionId: 'session-sophie', paymentIntentId: 'pi_sophie', amountCents: 2500, surplusCents: 1800 };

class FakePendingCaptures implements PendingCaptureRepository {
  readonly paid: ({ sessionId: string } & SettledPayment)[] = [];
  #pending: PendingCapture[];

  constructor(pending: PendingCapture[]) {
    this.#pending = pending;
  }

  listPending(): Promise<PendingCapture[]> {
    return Promise.resolve(this.#pending);
  }

  markPaid(sessionId: string, payment: SettledPayment): Promise<void> {
    this.paid.push({ sessionId, ...payment });
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
    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0 }]);
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
    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 975, surplusPaidCents: 0, unpaidCents: 0 }]);
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

    expect(captures.paid).toEqual([{ sessionId: 'session-julie', capturedCents: 900, surplusPaidCents: 0, unpaidCents: 0 }]);
  });

  it('goes on with the other sessions when one capture fails', async () => {
    const { captures, payments, run } = setup([julie, marc]);
    const capture = payments.capture.bind(payments);
    payments.capture = (request) => (request.sessionId === 'session-julie' ? Promise.resolve({ outcome: 'failed' }) : capture(request));

    await run();

    expect(captures.paid).toEqual([{ sessionId: 'session-marc', capturedCents: 300, surplusPaidCents: 0, unpaidCents: 0 }]);
  });

  describe('the surplus of a stay over 24 hours', () => {
    it('charges the surplus after the capture and records both', async () => {
      const { captures, payments, run } = setup([sophie]);

      await run();

      expect(payments.surcharged).toEqual([{ sessionId: 'session-sophie', paymentIntentId: 'pi_sophie', amountCents: 1800 }]);
      expect(captures.paid).toEqual([{ sessionId: 'session-sophie', capturedCents: 2500, surplusPaidCents: 1800, unpaidCents: 0 }]);
    });

    it('records an unpaid balance when the card refuses the surplus', async () => {
      const { captures, payments, run } = setup([sophie]);
      payments.surplusOutcome = 'declined';

      await run();

      expect(captures.paid).toEqual([{ sessionId: 'session-sophie', capturedCents: 2500, surplusPaidCents: 0, unpaidCents: 1800 }]);
    });

    it('keeps the session pending while Stripe cannot say whether the surplus was charged, then settles it', async () => {
      const { captures, payments, log, run } = setup([sophie]);
      payments.surplusOutcome = 'failed';

      await run();

      expect(captures.paid).toEqual([]);
      expect(log.warn).toHaveBeenCalledWith({ sessionId: 'session-sophie' }, 'surplus still pending, retried at the next run');

      payments.surplusOutcome = 'charged';
      await run();
      expect(captures.paid).toEqual([{ sessionId: 'session-sophie', capturedCents: 2500, surplusPaidCents: 1800, unpaidCents: 0 }]);
    });

    it('does not ask for the surplus while the capture still fails', async () => {
      const { payments, run } = setup([sophie]);
      payments.captureOutcome = 'failed';

      await run();

      expect(payments.surcharged).toEqual([]);
    });
  });
});

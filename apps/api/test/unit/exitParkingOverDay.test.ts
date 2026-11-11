import { describe, expect, it } from 'vitest';
import { exitParking } from '../../src/domain/exits/exitParking.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';
import { EXIT_SESSION_ID, FakeExits, JULIE_ID, julieInside } from './fakes/fakeExits.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);

function setup() {
  const exits = new FakeExits();
  const payments = new FakePaymentAuthorizer();
  exits.add(JULIE_ID, julieInside(enteredAt));
  const exit = (now: Date) => exitParking({ exits, payments }, { sessionId: EXIT_SESSION_ID, driverId: JULIE_ID, now });
  return { exits, payments, exit };
}

describe('exitParking a stay over 24 hours', () => {
  const after30Hours = new Date(enteredAt.getTime() + 30 * 60 * 60 * 1000);
  const after50Hours = new Date(enteredAt.getTime() + 50 * 60 * 60 * 1000);

  it('captures the 25 $ hold, charges 18 $ for the 6 hours beyond, and gives the receipt lines and the 43 $ total', async () => {
    const { exits, payments, exit } = setup();

    const result = await exit(after30Hours);

    expect(payments.captured).toMatchObject([{ amountCents: 2500 }]);
    expect(payments.surcharged).toEqual([{ sessionId: EXIT_SESSION_ID, paymentIntentId: 'pi_julie', amountCents: 1800 }]);
    expect(exits.closings).toMatchObject([{ exit: { capturedCents: 2500, surplusPaidCents: 1800, unpaidCents: 0 } }]);
    expect(result).toMatchObject({
      outcome: 'left',
      receipt: {
        totalCents: 4300,
        unpaidCents: 0,
        lines: [
          { kind: 'DAY', dayNumber: 1, cents: 2500 },
          { kind: 'EXTRA', minutes: 360, cents: 1800 },
        ],
      },
    });
  });

  it('bills 50 hours as 25 $, 25 $ and 6 $ for 2 hours, 56 $ in all', async () => {
    const { payments, exit } = setup();

    const result = await exit(after50Hours);

    expect(payments.surcharged).toMatchObject([{ amountCents: 3100 }]);
    expect(result).toMatchObject({
      receipt: {
        totalCents: 5600,
        lines: [
          { kind: 'DAY', dayNumber: 1, cents: 2500 },
          { kind: 'DAY', dayNumber: 2, cents: 2500 },
          { kind: 'EXTRA', minutes: 120, cents: 600 },
        ],
      },
    });
  });

  it('opens the barrier and records the 18 $ as unpaid when the card refuses the surplus', async () => {
    const { exits, payments, exit } = setup();
    payments.surplusOutcome = 'declined';

    const result = await exit(after30Hours);

    expect(exits.closings).toMatchObject([{ exit: { capturedCents: 2500, surplusPaidCents: 0, unpaidCents: 1800 } }]);
    expect(result).toMatchObject({ outcome: 'left', receipt: { totalCents: 2500, unpaidCents: 1800 } });
  });

  it('charges nothing beyond the hold for a stay of exactly 24 hours', async () => {
    const { payments, exit } = setup();

    await exit(new Date(enteredAt.getTime() + 24 * 60 * 60 * 1000));

    expect(payments.surcharged).toEqual([]);
  });

  it('leaves the surplus to the retry, without asking Stripe again, when the capture fails', async () => {
    const { exits, payments, exit } = setup();
    payments.captureOutcome = 'failed';

    expect(await exit(after30Hours)).toEqual({ outcome: 'capture-pending' });

    expect(payments.surcharged).toEqual([]);
    expect(exits.pendingClosings).toMatchObject([{ pendingCaptureCents: 2500, pendingSurplusCents: 1800 }]);
  });

  it('opens the barrier with the payment pending when Stripe cannot say whether it charged the surplus', async () => {
    const { exits, payments, exit } = setup();
    payments.surplusOutcome = 'failed';

    expect(await exit(after30Hours)).toEqual({ outcome: 'capture-pending' });

    expect(exits.closings).toEqual([]);
    expect(exits.pendingClosings).toMatchObject([{ pendingCaptureCents: 2500, pendingSurplusCents: 1800 }]);
  });

  it('records what an earlier tap already charged, not an unpaid balance, when a later tap asks another amount', async () => {
    const { exits, payments, exit } = setup();
    payments.alreadySurchargedCents = 1800;

    const result = await exit(new Date(after30Hours.getTime() + 15 * 60_000));

    expect(exits.closings).toMatchObject([{ exit: { capturedCents: 2500, surplusPaidCents: 1800, unpaidCents: 0 } }]);
    expect(result).toMatchObject({ outcome: 'left', receipt: { totalCents: 4300, unpaidCents: 0 } });
  });

  it('charges the surplus once when Julie taps twice', async () => {
    const { payments, exit } = setup();

    await exit(after30Hours);
    await exit(new Date(after30Hours.getTime() + 60_000));

    expect(payments.surcharged).toHaveLength(1);
  });
});

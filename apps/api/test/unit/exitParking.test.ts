import { describe, expect, it } from 'vitest';
import { exitParking } from '../../src/domain/exits/exitParking.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';
import { EXIT_GATE_ID, EXIT_SESSION_ID, FakeExits, JULIE_ID, julieInside } from './fakes/fakeExits.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const at2117 = new Date(2026, 10, 4, 21, 17);
const MARC_ID = 'driver-marc';

function setup() {
  const exits = new FakeExits();
  const payments = new FakePaymentAuthorizer();
  exits.add(JULIE_ID, julieInside(enteredAt));
  const exit = (driverId = JULIE_ID, now = at2117, sessionId = EXIT_SESSION_ID) => exitParking({ exits, payments }, { sessionId, driverId, now });
  return { exits, payments, exit };
}

describe('exitParking', () => {
  it('captures 9,75 $ on the entry authorization and gives the 3 h 15 receipt at 21 h 17', async () => {
    const { payments, exit } = setup();

    const result = await exit();

    expect(payments.captured).toEqual([{ sessionId: EXIT_SESSION_ID, paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(result).toEqual({
      outcome: 'left',
      receipt: { exitedAt: at2117.toISOString(), durationMinutes: 195, increments: 13, incrementCents: 75, totalCents: 975, capped: false },
    });
  });

  it('closes the session at the exit time and tells the lot to open the exit gate', async () => {
    const { exits, exit } = setup();

    await exit();

    expect(exits.closings).toEqual([
      { sessionId: EXIT_SESSION_ID, lotId: 'lot-demo', exitGateId: EXIT_GATE_ID, exit: { exitedAt: at2117, capturedCents: 975 } },
    ]);
  });

  it('never takes more than the card hold, and reports a total under the daily cap as capped', async () => {
    const { payments, exit } = setup();

    const result = await exit(JULIE_ID, new Date(2026, 10, 5, 4, 2));

    expect(payments.captured).toMatchObject([{ amountCents: 2500 }]);
    expect(result).toMatchObject({ outcome: 'left', receipt: { totalCents: 2500, capped: true } });
  });

  it('captures once and answers the existing receipt when Julie taps twice', async () => {
    const { payments, exits, exit } = setup();

    const first = await exit();
    const second = await exit(JULIE_ID, new Date(2026, 10, 4, 21, 18));

    expect(second).toEqual({ ...first, outcome: 'already' });
    expect(payments.captured).toHaveLength(1);
    expect(exits.closings).toHaveLength(1);
  });

  it('answers not found for Marc and takes nothing', async () => {
    const { payments, exits, exit } = setup();

    expect(await exit(MARC_ID)).toEqual({ outcome: 'not-found' });
    expect(await exit(JULIE_ID, at2117, 'no-such-session')).toEqual({ outcome: 'not-found' });
    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it.each([
    { state: 'CREATED', outcome: 'entry-not-confirmed' },
    { state: 'CANCELLED', outcome: 'closed' },
  ] as const)('refuses a $state session without taking anything', async ({ state, outcome }) => {
    const { exits, payments, exit } = setup();
    exits.add(JULIE_ID, { ...julieInside(enteredAt), state });

    expect(await exit()).toEqual({ outcome });
    expect(payments.captured).toEqual([]);
  });

  it('leaves the session open and takes nothing when the lot has no exit gate', async () => {
    const { exits, payments, exit } = setup();
    exits.add(JULIE_ID, { ...julieInside(enteredAt), exitGateId: null });

    expect(await exit()).toEqual({ outcome: 'gate-unavailable' });
    expect(payments.captured).toEqual([]);
  });

  it('leaves the session open when Stripe cannot capture', async () => {
    const { exits, payments, exit } = setup();
    payments.captureOutcome = 'failed';

    expect(await exit()).toEqual({ outcome: 'payments-unavailable' });
    expect(exits.closings).toEqual([]);
  });

  it('keeps the amount Stripe took when a first tap captured but could not close, and Julie taps again a few minutes later', async () => {
    const { exits, payments, exit } = setup();
    exits.busy = true;
    expect(await exit()).toEqual({ outcome: 'lot-busy' });
    exits.busy = false;
    payments.alreadyCapturedCents = 975;

    const retap = await exit(JULIE_ID, new Date(2026, 10, 4, 21, 20));

    expect(retap).toMatchObject({ outcome: 'left', receipt: { totalCents: 975, durationMinutes: 198 } });
    expect(exits.closings).toMatchObject([{ exit: { capturedCents: 975 } }]);
  });

  it('answers payments unavailable when the server has no Stripe key', async () => {
    const { exits } = setup();

    expect(await exitParking({ exits, payments: null }, { sessionId: EXIT_SESSION_ID, driverId: JULIE_ID, now: at2117 })).toEqual({
      outcome: 'payments-unavailable',
    });
  });

  it('answers lot busy when the lot stays locked', async () => {
    const { exits, exit } = setup();
    exits.busy = true;

    expect(await exit()).toEqual({ outcome: 'lot-busy' });
  });
});

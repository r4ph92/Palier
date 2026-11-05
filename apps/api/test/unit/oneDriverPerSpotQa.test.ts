import { describe, expect, it } from 'vitest';
import { readPaymentsSimulation } from '../../src/config/paymentsSimulation.ts';
import { decideRepeatedScan, type ActiveSessionFacts } from '../../src/domain/entries/decideRepeatedScan.ts';
import { admissionRefusalOf } from '../../src/infrastructure/postgres/admissionRefusal.ts';
import { postgresErrorOf } from '../../src/infrastructure/postgres/postgresError.ts';
import { SimulatedPaymentAuthorizer } from '../../src/infrastructure/stripe/SimulatedPaymentAuthorizer.ts';
import { parseEntryLoadArguments } from '../../src/load/entryLoadArguments.ts';

const scanned = { lotId: 'lot-demo', entryGateId: 'gate-entree-demo' };
const spot = { number: 'A-1', levelCode: 'P1', aisleCode: 'A' };

interface ReplayCondition {
  readonly sameLot: boolean;
  readonly sameGate: boolean;
  readonly created: boolean;
  readonly withinWindow: boolean;
}

function activeSessionWith({ sameLot, sameGate, created, withinWindow }: ReplayCondition): ActiveSessionFacts {
  return {
    id: 'session-1',
    lotId: sameLot ? scanned.lotId : 'lot-roy',
    entryGateId: sameGate ? scanned.entryGateId : 'gate-other',
    state: created ? 'CREATED' : 'ENTRY_CONFIRMED',
    isWithinOpeningWindow: withinWindow,
    spot,
  };
}

const everyCondition: ReplayCondition[] = [false, true].flatMap((sameLot) =>
  [false, true].flatMap((sameGate) =>
    [false, true].flatMap((created) => [false, true].map((withinWindow) => ({ sameLot, sameGate, created, withinWindow }))),
  ),
);

describe('a repeated scan by a driver who already has an active session', () => {
  it.each(everyCondition)('replays only when the lot, the gate, the CREATED state and the window all match: %o', (condition) => {
    const decision = decideRepeatedScan(activeSessionWith(condition), scanned);
    const allMatch = condition.sameLot && condition.sameGate && condition.created && condition.withinWindow;

    expect(decision.kind).toBe(allMatch ? 'replay' : 'refuse');
  });
});

describe('the lock-timeout refusal', () => {
  it('still answers PAYMENTS_UNAVAILABLE when the lock timeout is wrapped twice', () => {
    const wrapped = new Error('transaction failed', { cause: new Error('Failed query', { cause: { code: '55P03' } }) });

    expect(admissionRefusalOf(wrapped, 'lot-demo')).toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE' });
  });

  it('stops on an error that is its own cause instead of looping', () => {
    const looping = new Error('loop');
    Object.assign(looping, { cause: looping });

    expect(postgresErrorOf(looping)).toBeNull();
  });
});

describe('the simulated payments switch', () => {
  it.each(['staging', 'preview', 'PRODUCTION'])('refuses PAYMENTS_SIMULATION=success when NODE_ENV is %s', (environment) => {
    expect(() => readPaymentsSimulation({ NODE_ENV: environment, PAYMENTS_SIMULATION: 'success' })).toThrow(/only allowed/);
  });

  it('refuses PAYMENTS_SIMULATION=success beside a live key, never faking holds next to one', () => {
    expect(() => readPaymentsSimulation({ NODE_ENV: 'development', PAYMENTS_SIMULATION: 'success', STRIPE_SECRET_KEY: 'sk_live_x' })).toThrow();
  });

  it.each(['TRUE', 'FALSE', 'no', '0'])('refuses to start while the renamed SIMULATE_STRIPE_UNREACHABLE is %s', (rawSwitch) => {
    expect(() => readPaymentsSimulation({ NODE_ENV: 'development', SIMULATE_STRIPE_UNREACHABLE: rawSwitch })).toThrow(/was renamed/);
  });

  it('answers the same intent for the same session, as Stripe would for a retried idempotency key', async () => {
    const payments = new SimulatedPaymentAuthorizer();
    const request = { customerId: 'cus_sim_1', paymentMethodId: 'pm_sim_1', amountCents: 2500, destinationAccountId: null, sessionId: 'session-1' };

    expect(await payments.authorize(request)).toBe(await payments.authorize(request));
  });
});

describe('the load script arguments', () => {
  it.each(['1e1', '0x5', ' 3', '3 '])('refuses --drivers %j, which is not written as a whole number', (drivers) => {
    expect(() => parseEntryLoadArguments(['--drivers', drivers], {})).toThrow(/--drivers must be a whole number from 1 to 20/);
  });

  it.each(['http://[::1]:3042', 'http://LOCALHOST:3042', 'https://localhost:3042'])('accepts a local API written %s', (api) => {
    expect(parseEntryLoadArguments(['--api', api], {}).apiUrl.hostname).toMatch(/^(\[::1\]|localhost)$/);
  });

  it.each(['http://0.0.0.0:3042', 'http://127.0.0.1@evil.test:3042', 'http://localhost.evil.test:3042', 'http://127.0.0.2:3042'])(
    'refuses %s, which does not reach this machine by name',
    (api) => {
      expect(() => parseEntryLoadArguments(['--api', api], {})).toThrow(/must point at this machine/);
    },
  );
});

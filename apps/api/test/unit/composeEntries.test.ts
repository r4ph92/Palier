import { describe, expect, it } from 'vitest';
import { paymentAuthorizer } from '../../src/composeEntries.ts';
import { SimulatedPaymentAuthorizer } from '../../src/infrastructure/stripe/SimulatedPaymentAuthorizer.ts';
import { StripePaymentAuthorizer } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';
import { UnreachablePaymentAuthorizer } from '../../src/infrastructure/stripe/UnreachablePaymentAuthorizer.ts';

const testKey = 'sk_test_palier';

describe('paymentAuthorizer', () => {
  it.each([testKey, null])('simulates Stripe unreachable when asked, with key %s', (stripeKey) => {
    expect(paymentAuthorizer(stripeKey, 'unreachable')).toBeInstanceOf(UnreachablePaymentAuthorizer);
  });

  it('simulates successful holds when asked on a lane without a key', () => {
    expect(paymentAuthorizer(null, 'success')).toBeInstanceOf(SimulatedPaymentAuthorizer);
  });

  it('simulates a capture outage when asked: the hold works, the capture fails', async () => {
    const payments = paymentAuthorizer(null, 'capture-unreachable');

    expect(await payments?.authorize({ sessionId: 's1', customerId: 'c', paymentMethodId: 'p', amountCents: 2500, destinationAccountId: null })).toBe('pi_sim_s1');
    expect(await payments?.capture({ sessionId: 's1', paymentIntentId: 'pi_sim_s1', amountCents: 975 })).toEqual({ outcome: 'failed' });
  });

  it('simulates a declined surplus when asked: the capture works, the charge beyond the hold fails', async () => {
    const payments = paymentAuthorizer(null, 'surplus-declined');

    expect(await payments?.capture({ sessionId: 's1', paymentIntentId: 'pi_sim_s1', amountCents: 2500 })).toEqual({ outcome: 'captured', amountCents: 2500 });
    expect(await payments?.chargeSurplus({ sessionId: 's1', paymentIntentId: 'pi_sim_s1', amountCents: 1800 })).toEqual({ outcome: 'failed' });
  });

  it('calls Stripe when nothing is simulated and a key is set', () => {
    expect(paymentAuthorizer(testKey, 'none')).toBeInstanceOf(StripePaymentAuthorizer);
  });

  it('has no authorizer when nothing is simulated and no key is set', () => {
    expect(paymentAuthorizer(null, 'none')).toBeNull();
  });
});

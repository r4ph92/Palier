import { describe, expect, it } from 'vitest';
import { paymentAuthorizer } from '../../src/composeEntries.ts';
import { StripePaymentAuthorizer } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';
import { UnreachablePaymentAuthorizer } from '../../src/infrastructure/stripe/UnreachablePaymentAuthorizer.ts';

const testKey = 'sk_test_palier';

describe('paymentAuthorizer', () => {
  it.each([testKey, null])('simulates Stripe unreachable when the switch is on, with key %s', (stripeKey) => {
    expect(paymentAuthorizer(stripeKey, true)).toBeInstanceOf(UnreachablePaymentAuthorizer);
  });

  it('calls Stripe when the switch is off and a key is set', () => {
    expect(paymentAuthorizer(testKey, false)).toBeInstanceOf(StripePaymentAuthorizer);
  });

  it('has no authorizer when the switch is off and no key is set', () => {
    expect(paymentAuthorizer(null, false)).toBeNull();
  });
});

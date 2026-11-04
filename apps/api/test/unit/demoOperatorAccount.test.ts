import { describe, expect, it } from 'vitest';
import { readDemoOperatorStripeAccountId } from '../../src/config/environment.ts';

describe('readDemoOperatorStripeAccountId', () => {
  it.each([[undefined], ['']])('leaves the demo operator without account when the variable is %j', (accountId) => {
    expect(readDemoOperatorStripeAccountId({ DEMO_OPERATOR_STRIPE_ACCOUNT_ID: accountId })).toBeNull();
  });

  it('reads a connected account id', () => {
    expect(readDemoOperatorStripeAccountId({ DEMO_OPERATOR_STRIPE_ACCOUNT_ID: 'acct_1Lavoie' })).toBe('acct_1Lavoie');
  });

  it.each(['cus_123', 'sk_test_123', 'lavoie'])('refuses %s, which is not an account id', (accountId) => {
    expect(() => readDemoOperatorStripeAccountId({ DEMO_OPERATOR_STRIPE_ACCOUNT_ID: accountId })).toThrow(/acct_/);
  });
});

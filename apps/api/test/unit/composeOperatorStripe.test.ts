import { describe, expect, it } from 'vitest';
import { composeOperatorStripe } from '../../src/composeOperatorStripe.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';

// Nothing here reaches the database or Stripe: the parts are only built.
const database = {} as Database;
const settings = { database, stripeKey: 'sk_test_unit_tests', webhookSecret: 'whsec_unit_tests', dashboardUrl: 'http://localhost:5173' };

describe('composing the operator Stripe parts', () => {
  it('builds onboarding and the webhook reader when every setting is present', () => {
    const composed = composeOperatorStripe(settings);

    expect(composed.gateway).not.toBeNull();
    expect(composed.webhookReader).not.toBeNull();
  });

  it('has neither without a Stripe key', () => {
    const composed = composeOperatorStripe({ ...settings, stripeKey: null });

    expect([composed.gateway, composed.webhookReader]).toEqual([null, null]);
  });

  it('has no webhook reader without a signing secret, but still onboarding', () => {
    const composed = composeOperatorStripe({ ...settings, webhookSecret: null });

    expect(composed.gateway).not.toBeNull();
    expect(composed.webhookReader).toBeNull();
  });

  it('has no onboarding without a dashboard address, but still the webhook reader', () => {
    const composed = composeOperatorStripe({ ...settings, dashboardUrl: null });

    expect(composed.gateway).toBeNull();
    expect(composed.webhookReader).not.toBeNull();
  });
});

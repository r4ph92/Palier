import { describe, expect, it, vi } from 'vitest';
import { OperatorStripeUnavailableError } from '../../src/domain/dashboard/OperatorStripe.ts';
import { StripeOperatorGateway, type OperatorAccountsApi } from '../../src/infrastructure/stripe/StripeOperatorGateway.ts';

const OPERATOR_ID = '00000000-0000-4000-8000-000000000102';
const urls = { returnUrl: 'http://localhost:5173/?stripe=return', refreshUrl: 'http://localhost:5173/?stripe=refresh' };

function fakeStripe(failure?: Error) {
  const createAccount = vi.fn(() => (failure === undefined ? Promise.resolve({ id: 'acct_1Roy' }) : Promise.reject(failure)));
  const createLink = vi.fn(() => (failure === undefined ? Promise.resolve({ url: 'https://connect.stripe.com/setup/e/acct_1Roy/x' }) : Promise.reject(failure)));
  const api: OperatorAccountsApi = { accounts: { create: createAccount }, accountLinks: { create: createLink } };
  return { gateway: new StripeOperatorGateway(api, urls), createAccount, createLink };
}

describe('the Stripe operator gateway', () => {
  it('creates a Canadian Express account for the operator, keyed by the operator so a retry reuses it', async () => {
    const { gateway, createAccount } = fakeStripe();

    const accountId = await gateway.createExpressAccount(OPERATOR_ID, 'Garages Roy');

    expect(accountId).toBe('acct_1Roy');
    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'express', country: 'CA', metadata: { operatorId: OPERATOR_ID }, business_profile: { name: 'Garages Roy' } }),
      { idempotencyKey: `operator-account-${OPERATOR_ID}` },
    );
  });

  it('asks Stripe for a hosted onboarding link that returns to the dashboard', async () => {
    const { gateway, createLink } = fakeStripe();

    const url = await gateway.createOnboardingLink('acct_1Roy');

    expect(url).toBe('https://connect.stripe.com/setup/e/acct_1Roy/x');
    expect(createLink).toHaveBeenCalledWith({ account: 'acct_1Roy', type: 'account_onboarding', return_url: urls.returnUrl, refresh_url: urls.refreshUrl });
  });

  it('turns any Stripe failure into the unavailable error, keeping the cause for the log', async () => {
    const failure = new Error('connection reset');
    const { gateway } = fakeStripe(failure);

    await expect(gateway.createExpressAccount(OPERATOR_ID, 'Garages Roy')).rejects.toEqual(new OperatorStripeUnavailableError({ cause: failure }));
    await expect(gateway.createOnboardingLink('acct_1Roy')).rejects.toBeInstanceOf(OperatorStripeUnavailableError);
  });
});

import type Stripe from 'stripe';
import { OperatorStripeUnavailableError, type OperatorStripeGateway } from '../../domain/dashboard/OperatorStripe.ts';

// Parking fees are charged in Canadian dollars to drivers in Quebec, so the operators are Canadian accounts.
const COUNTRY = 'CA';

// The part of the Stripe client the gateway uses, so tests can pass a fake.
export interface OperatorAccountsApi {
  readonly accounts: {
    create(params: Stripe.AccountCreateParams, options: Stripe.RequestOptions): Promise<{ readonly id: string }>;
  };
  readonly accountLinks: {
    create(params: Stripe.AccountLinkCreateParams): Promise<{ readonly url: string }>;
  };
}

export interface OnboardingReturnUrls {
  readonly returnUrl: string;
  readonly refreshUrl: string;
}

export class StripeOperatorGateway implements OperatorStripeGateway {
  readonly #stripe: OperatorAccountsApi;
  readonly #urls: OnboardingReturnUrls;

  constructor(stripe: OperatorAccountsApi, urls: OnboardingReturnUrls) {
    this.#stripe = stripe;
    this.#urls = urls;
  }

  createExpressAccount(operatorId: string, legalName: string): Promise<string> {
    return this.#stripeCall(async () => {
      const account = await this.#stripe.accounts.create(
        {
          type: 'express',
          country: COUNTRY,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { name: legalName },
          metadata: { operatorId },
        },
        { idempotencyKey: `operator-account-${operatorId}` },
      );
      return account.id;
    });
  }

  createOnboardingLink(accountId: string): Promise<string> {
    return this.#stripeCall(async () => {
      const link = await this.#stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        return_url: this.#urls.returnUrl,
        refresh_url: this.#urls.refreshUrl,
      });
      return link.url;
    });
  }

  async #stripeCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new OperatorStripeUnavailableError({ cause: error });
    }
  }
}

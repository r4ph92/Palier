import type Stripe from 'stripe';
import { CardProviderUnavailableError, type CardGateway, type CardPaymentMethod } from '../../domain/payments/CardGateway.ts';
import type { Driver } from '../../domain/drivers/Driver.ts';

const RESOURCE_MISSING = 'resource_missing';

export class StripeCardGateway implements CardGateway {
  readonly #stripe: Stripe;

  constructor(stripe: Stripe) {
    this.#stripe = stripe;
  }

  async createCustomer(driver: Driver): Promise<string> {
    return this.#stripeCall(async () => {
      const customer = await this.#stripe.customers.create({
        name: `${driver.firstName} ${driver.lastName}`,
        metadata: { driverId: driver.id },
      });
      return customer.id;
    });
  }

  async createSetupIntentClientSecret(customerId: string): Promise<string> {
    return this.#stripeCall(async () => {
      const setupIntent = await this.#stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
      if (setupIntent.client_secret === null) {
        throw new Error('Stripe returned a SetupIntent without a client secret.');
      }
      return setupIntent.client_secret;
    });
  }

  async findCardPaymentMethod(paymentMethodId: string): Promise<CardPaymentMethod | null> {
    return this.#stripeCall(async () => {
      const paymentMethod = await this.#retrievePaymentMethod(paymentMethodId);
      if (paymentMethod === null || paymentMethod.card === undefined) {
        return null;
      }
      const customer = paymentMethod.customer;
      return {
        customerId: typeof customer === 'string' ? customer : (customer?.id ?? null),
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
      };
    });
  }

  async #retrievePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod | null> {
    try {
      return await this.#stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      if (isResourceMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.#stripeCall(() => this.#stripe.paymentMethods.detach(paymentMethodId));
  }

  // Any Stripe failure leaves here as the same fixed error, so the client never sees Stripe's text.
  async #stripeCall<Result>(call: () => Promise<Result>): Promise<Result> {
    try {
      return await call();
    } catch (error) {
      throw new CardProviderUnavailableError({ cause: error });
    }
  }
}

function isResourceMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === RESOURCE_MISSING;
}

import type Stripe from 'stripe';
import { InvalidWebhookSignatureError, type AccountSnapshot, type AccountWebhookReader } from '../../domain/dashboard/OperatorStripe.ts';

const ACCOUNT_UPDATED = 'account.updated';

// The part of the Stripe client the reader uses: the signature check works offline, with the endpoint's signing secret.
export interface WebhooksApi {
  readonly webhooks: { constructEvent(payload: Buffer, header: string, secret: string): Stripe.Event };
}

export class StripeAccountWebhookReader implements AccountWebhookReader {
  readonly #stripe: WebhooksApi;
  readonly #signingSecret: string;

  constructor(stripe: WebhooksApi, signingSecret: string) {
    this.#stripe = stripe;
    this.#signingSecret = signingSecret;
  }

  read(rawBody: Buffer, signature: string | undefined): AccountSnapshot | null {
    const event = this.#verified(rawBody, signature);
    if (event.type !== ACCOUNT_UPDATED) {
      return null;
    }
    const account = event.data.object;
    return {
      accountId: account.id,
      detailsSubmitted: account.details_submitted ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      currentlyDue: account.requirements?.currently_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
    };
  }

  #verified(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    if (signature === undefined) {
      throw new InvalidWebhookSignatureError();
    }
    try {
      return this.#stripe.webhooks.constructEvent(rawBody, signature, this.#signingSecret);
    } catch (error) {
      throw new InvalidWebhookSignatureError({ cause: error });
    }
  }
}

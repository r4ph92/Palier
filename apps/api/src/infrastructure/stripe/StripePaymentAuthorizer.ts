import type Stripe from 'stripe';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type { AuthorizationRequest, HoldRelease, PaymentAuthorizer } from '../../domain/entries/PaymentAuthorizer.ts';

const CURRENCY = 'cad';
const AUTHORIZED = 'requires_capture';
const CANCELED = 'canceled';
const CARD_ERROR = 'StripeCardError';
const UNEXPECTED_STATE = 'payment_intent_unexpected_state';
const MISSING = 'resource_missing';

interface CreatedIntent {
  readonly id: string;
  readonly status: string;
}

// The part of the Stripe client the authorizer uses, so tests can pass a fake.
export interface PaymentIntentsApi {
  readonly paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions): Promise<CreatedIntent>;
    cancel(paymentIntentId: string): Promise<unknown>;
  };
}

export class StripePaymentAuthorizer implements PaymentAuthorizer {
  readonly #stripe: PaymentIntentsApi;

  constructor(stripe: PaymentIntentsApi) {
    this.#stripe = stripe;
  }

  async authorize(request: AuthorizationRequest): Promise<string> {
    const intent = await this.#createIntent(request);
    // Anything but an authorized hold (3-D Secure asked, card refused) means the driver cannot enter.
    if (intent.status !== AUTHORIZED) {
      throw new EntryRefusedError('CARD_DECLINED');
    }
    return intent.id;
  }

  async cancel(paymentIntentId: string): Promise<HoldRelease> {
    try {
      await this.#stripe.paymentIntents.cancel(paymentIntentId);
      return 'released';
    } catch (error) {
      return releaseAfterRefusal(error);
    }
  }

  // The idempotency key is the session, so Stripe's own retries never create a second hold for one entry.
  async #createIntent(request: AuthorizationRequest): Promise<CreatedIntent> {
    try {
      return await this.#stripe.paymentIntents.create(intentParameters(request), { idempotencyKey: `entry-${request.sessionId}` });
    } catch (error) {
      throw new EntryRefusedError(isCardError(error) ? 'CARD_DECLINED' : 'PAYMENTS_UNAVAILABLE', { cause: error });
    }
  }
}

function intentParameters(request: AuthorizationRequest): Stripe.PaymentIntentCreateParams {
  const parameters: Stripe.PaymentIntentCreateParams = {
    amount: request.amountCents,
    currency: CURRENCY,
    customer: request.customerId,
    payment_method: request.paymentMethodId,
    capture_method: 'manual',
    confirm: true,
    off_session: true,
    metadata: { sessionId: request.sessionId },
  };
  if (request.destinationAccountId === null) {
    return parameters;
  }
  return { ...parameters, transfer_data: { destination: request.destinationAccountId } };
}

// An intent already canceled is the release we wanted; one missing or in another final state never will be.
function releaseAfterRefusal(error: unknown): HoldRelease {
  const code = propertyOf(error, 'code');
  if (code === UNEXPECTED_STATE) {
    return propertyOf(propertyOf(error, 'payment_intent'), 'status') === CANCELED ? 'released' : 'gone';
  }
  return code === MISSING ? 'gone' : 'failed';
}

function propertyOf(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null && name in value ? (value as Record<string, unknown>)[name] : undefined;
}

function isCardError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === CARD_ERROR;
}

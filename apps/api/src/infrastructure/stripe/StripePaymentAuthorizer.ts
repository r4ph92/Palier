import type Stripe from 'stripe';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import type {
  AuthorizationRequest,
  CaptureOutcome,
  CaptureRequest,
  HoldRelease,
  PaymentAuthorizer,
  SurplusOutcome,
  SurplusRequest,
} from '../../domain/entries/PaymentAuthorizer.ts';

const CURRENCY = 'cad';
const AUTHORIZED = 'requires_capture';
const CANCELED = 'canceled';
const SUCCEEDED = 'succeeded';
const PROCESSING = 'processing';
const SURPLUS = 'surplus';
// Every intent of the customer since the entry: far more than one driver makes, so the session's surplus is always among them.
const SURPLUS_LOOKUP_LIMIT = 100;
const CARD_ERROR = 'StripeCardError';
const INVALID_REQUEST = 'StripeInvalidRequestError';
const UNEXPECTED_STATE = 'payment_intent_unexpected_state';
const MISSING = 'resource_missing';
const KEY_IN_USE = 'idempotency_key_in_use';
const KEY_IN_USE_RETRY_MILLISECONDS = 400;

interface CreatedIntent {
  readonly id: string;
  readonly status: string;
}

// What the entry authorization says of the card and the operator account the surplus goes to.
export interface EntryIntent {
  readonly created: number;
  readonly customer: string | { readonly id: string } | null;
  readonly payment_method: string | { readonly id: string } | null;
  readonly transfer_data?: { readonly destination: string | { readonly id: string } } | null;
}

// The part of the Stripe client the authorizer uses, so tests can pass a fake.
export interface PaymentIntentsApi {
  readonly paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions): Promise<CreatedIntent>;
    retrieve(paymentIntentId: string): Promise<EntryIntent>;
    cancel(paymentIntentId: string): Promise<unknown>;
    capture(paymentIntentId: string, params: Stripe.PaymentIntentCaptureParams, options: Stripe.RequestOptions): Promise<{ readonly amount_received: number }>;
    list(params: Stripe.PaymentIntentListParams): Promise<{ readonly data: readonly ListedIntent[] }>;
  };
}

// What a listed intent says of a surplus charge.
export interface ListedIntent {
  readonly status: string;
  readonly amount_received: number;
  readonly metadata: Stripe.Metadata | null;
}

export class StripePaymentAuthorizer implements PaymentAuthorizer {
  readonly #stripe: PaymentIntentsApi;

  readonly #keyInUseRetryMilliseconds: number;

  constructor(stripe: PaymentIntentsApi, keyInUseRetryMilliseconds = KEY_IN_USE_RETRY_MILLISECONDS) {
    this.#stripe = stripe;
    this.#keyInUseRetryMilliseconds = keyInUseRetryMilliseconds;
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

  // The key names the session and the amount, so a retry of the same capture replays it and a later one asking another amount is not an
  // idempotency conflict. An intent already captured answers what it really took: the receipt never differs from the charge.
  // A second tap racing the first finds the key in use: it waits a moment, then replays the first capture's answer.
  async capture(request: CaptureRequest): Promise<CaptureOutcome> {
    const first = await this.#captureOnce(request);
    if (first !== KEY_IN_USE) {
      return first;
    }
    await new Promise((resolve) => setTimeout(resolve, this.#keyInUseRetryMilliseconds));
    const second = await this.#captureOnce(request);
    return second === KEY_IN_USE ? { outcome: 'failed' } : second;
  }

  async #captureOnce({ sessionId, paymentIntentId, amountCents }: CaptureRequest): Promise<CaptureOutcome | typeof KEY_IN_USE> {
    try {
      const intent = await this.#stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amountCents }, { idempotencyKey: `exit-${sessionId}-${amountCents}` });
      return { outcome: 'captured', amountCents: intent.amount_received };
    } catch (error) {
      return propertyOf(error, 'code') === KEY_IN_USE ? KEY_IN_USE : capturedBefore(error);
    }
  }

  // The key names the session only, so a second tap asking another amount is refused by Stripe rather than charged twice. Before charging,
  // and after any error but a card refusal, the session's surplus is looked up among the customer's intents: an earlier tap's charge, or
  // one Stripe took before a timeout, is answered as it is instead of read as unpaid.
  async chargeSurplus({ sessionId, paymentIntentId, amountCents }: SurplusRequest): Promise<SurplusOutcome> {
    try {
      const entry = await this.#stripe.paymentIntents.retrieve(paymentIntentId);
      return (await this.#surplusOf(sessionId, entry)) ?? (await this.#createSurplus(sessionId, amountCents, entry));
    } catch {
      return { outcome: 'failed' };
    }
  }

  async #createSurplus(sessionId: string, amountCents: number, entry: EntryIntent): Promise<SurplusOutcome> {
    try {
      const intent = await this.#stripe.paymentIntents.create(surplusParameters(sessionId, amountCents, entry), { idempotencyKey: `exit-extra-${sessionId}` });
      return surplusOutcomeOf(intent.status, amountCents);
    } catch (error) {
      const keyInUse = propertyOf(error, 'code') === KEY_IN_USE;
      // A refused card, or a request Stripe will never accept (the entry card detached since), is unpaid rather than retried forever.
      if (isCardError(error) || (propertyOf(error, 'type') === INVALID_REQUEST && !keyInUse)) {
        return { outcome: 'declined' };
      }
      // A second tap racing the first finds the key in use: it waits a moment for the first charge to settle.
      if (keyInUse) {
        await new Promise((resolve) => setTimeout(resolve, this.#keyInUseRetryMilliseconds));
      }
      return (await this.#surplusOf(sessionId, entry)) ?? { outcome: 'failed' };
    }
  }

  // Null when the session has no surplus charge yet.
  async #surplusOf(sessionId: string, entry: EntryIntent): Promise<SurplusOutcome | null> {
    const intents = await this.#stripe.paymentIntents.list({ customer: idOf(entry.customer), created: { gte: entry.created }, limit: SURPLUS_LOOKUP_LIMIT });
    const surplus = intents.data.find((intent) => intent.metadata?.sessionId === sessionId && intent.metadata.kind === SURPLUS);
    return surplus === undefined ? null : surplusOutcomeOf(surplus.status, surplus.amount_received);
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

function surplusParameters(sessionId: string, amountCents: number, entry: EntryIntent): Stripe.PaymentIntentCreateParams {
  const parameters: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: CURRENCY,
    customer: idOf(entry.customer),
    payment_method: idOf(entry.payment_method),
    confirm: true,
    off_session: true,
    // A card that needs the driver (3-D Secure) is refused outright rather than left open on Stripe's side.
    error_on_requires_action: true,
    metadata: { sessionId, kind: SURPLUS },
  };
  return entry.transfer_data?.destination === undefined ? parameters : { ...parameters, transfer_data: { destination: idOf(entry.transfer_data.destination) } };
}

function idOf(reference: string | { readonly id: string } | null): string {
  if (reference === null) {
    throw new Error('The entry authorization has no card to charge.');
  }
  return typeof reference === 'string' ? reference : reference.id;
}

// A card charge settles at once: anything but succeeded is a refusal, save one still processing, which is read again later.
function surplusOutcomeOf(status: string, chargedCents: number): SurplusOutcome {
  if (status === SUCCEEDED) {
    return { outcome: 'charged', amountCents: chargedCents };
  }
  return status === PROCESSING ? { outcome: 'failed' } : { outcome: 'declined' };
}

function capturedBefore(error: unknown): CaptureOutcome {
  const intent = propertyOf(error, 'payment_intent');
  const received = propertyOf(intent, 'amount_received');
  if (propertyOf(error, 'code') === UNEXPECTED_STATE && propertyOf(intent, 'status') === SUCCEEDED && typeof received === 'number') {
    return { outcome: 'captured', amountCents: received };
  }
  return { outcome: 'failed' };
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

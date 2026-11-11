import { vi } from 'vitest';
import type Stripe from 'stripe';
import type { EntryIntent, ListedIntent, PaymentIntentsApi } from '../../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';

// When Julie's entry authorization was made, in Stripe's seconds.
export const ENTRY_CREATED = 1_793_000_000;

export function surplusIntent(sessionId: string, status: string, amountReceived: number): ListedIntent {
  return { status, amount_received: amountReceived, metadata: { sessionId, kind: 'surplus' } };
}

export function fakeStripe(created: Promise<{ id: string; status: string }>) {
  const create = vi.fn<(params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions) => Promise<{ id: string; status: string }>>(
    () => created,
  );
  const cancel = vi.fn<(paymentIntentId: string) => Promise<unknown>>(() => Promise.resolve({}));
  const capture = vi.fn<(paymentIntentId: string, params: Stripe.PaymentIntentCaptureParams, options: Stripe.RequestOptions) => Promise<{ amount_received: number }>>(() =>
    Promise.resolve({ amount_received: 975 }),
  );
  const retrieve = vi.fn<(paymentIntentId: string) => Promise<EntryIntent>>(() =>
    Promise.resolve({ created: ENTRY_CREATED, customer: 'cus_julie', payment_method: 'pm_julie', transfer_data: { destination: 'acct_1Lavoie' } }),
  );
  // No surplus yet for the customer, unless a test says otherwise.
  const list = vi.fn<(params: Stripe.PaymentIntentListParams) => Promise<{ data: readonly ListedIntent[] }>>(() => Promise.resolve({ data: [] }));
  const stripe: PaymentIntentsApi = { paymentIntents: { create, retrieve, cancel, capture, list } };
  return { stripe, create, retrieve, cancel, capture, list };
}

import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { AuthorizationRequest } from '../../src/domain/entries/PaymentAuthorizer.ts';
import { StripePaymentAuthorizer, type PaymentIntentsApi } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';

const request: AuthorizationRequest = {
  sessionId: 'session-1',
  customerId: 'cus_julie',
  paymentMethodId: 'pm_julie',
  amountCents: 2500,
  destinationAccountId: 'acct_1Lavoie',
};

function fakeStripe(created: Promise<{ id: string; status: string }>) {
  const create = vi.fn<(params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions) => Promise<{ id: string; status: string }>>(
    () => created,
  );
  const cancel = vi.fn<(paymentIntentId: string) => Promise<unknown>>(() => Promise.resolve({}));
  const stripe: PaymentIntentsApi = { paymentIntents: { create, cancel } };
  return { stripe, create, cancel };
}

describe('StripePaymentAuthorizer', () => {
  it('holds the daily cap in CAD without capturing it, toward the operator account', async () => {
    const { stripe, create } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));

    expect(await new StripePaymentAuthorizer(stripe).authorize(request)).toBe('pi_1');
    expect(create).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: 'cad',
        customer: 'cus_julie',
        payment_method: 'pm_julie',
        capture_method: 'manual',
        confirm: true,
        off_session: true,
        metadata: { sessionId: 'session-1' },
        transfer_data: { destination: 'acct_1Lavoie' },
      },
      { idempotencyKey: 'entry-session-1' },
    );
  });

  it('keeps the hold on the platform when there is no operator account', async () => {
    const { stripe, create } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));

    await new StripePaymentAuthorizer(stripe).authorize({ ...request, destinationAccountId: null });

    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('transfer_data');
  });

  it.each(['requires_action', 'requires_payment_method', 'succeeded'])('refuses an intent left in %s as CARD_DECLINED', async (status) => {
    const { stripe } = fakeStripe(Promise.resolve({ id: 'pi_1', status }));

    await expect(new StripePaymentAuthorizer(stripe).authorize(request)).rejects.toMatchObject({ reason: 'CARD_DECLINED' });
  });

  it('refuses a card error as CARD_DECLINED', async () => {
    const { stripe } = fakeStripe(Promise.reject(Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError' })));

    await expect(new StripePaymentAuthorizer(stripe).authorize(request)).rejects.toMatchObject({ reason: 'CARD_DECLINED' });
  });

  it.each(['StripeConnectionError', 'StripeAPIError', 'StripeInvalidRequestError'])(
    'refuses a %s as PAYMENTS_UNAVAILABLE without Stripe text',
    async (type) => {
      const { stripe } = fakeStripe(Promise.reject(Object.assign(new Error('secret Stripe detail'), { type })));

      const refusal = new StripePaymentAuthorizer(stripe).authorize(request);

      await expect(refusal).rejects.toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE', message: 'Card payments are unavailable right now.' });
    },
  );

  it('cancels a hold by its intent id', async () => {
    const { stripe, cancel } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));

    await new StripePaymentAuthorizer(stripe).cancel('pi_1');

    expect(cancel).toHaveBeenCalledWith('pi_1');
  });
});

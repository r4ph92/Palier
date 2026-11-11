import { describe, expect, it } from 'vitest';
import type { AuthorizationRequest } from '../../src/domain/entries/PaymentAuthorizer.ts';
import { StripePaymentAuthorizer } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';
import { fakeStripe } from './fakes/fakeStripeIntents.ts';

const request: AuthorizationRequest = {
  sessionId: 'session-1',
  customerId: 'cus_julie',
  paymentMethodId: 'pm_julie',
  amountCents: 2500,
  destinationAccountId: 'acct_1Lavoie',
};

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

  it('cancels a hold by its intent id, without a custom idempotency key', async () => {
    const { stripe, cancel } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));

    expect(await new StripePaymentAuthorizer(stripe).cancel('pi_1')).toBe('released');
    expect(cancel).toHaveBeenCalledWith('pi_1');
  });

  function refusedCancel(error: unknown) {
    const { stripe, cancel } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));
    cancel.mockRejectedValueOnce(error);
    return new StripePaymentAuthorizer(stripe).cancel('pi_1');
  }

  it('answers released for an intent Stripe already canceled', async () => {
    const alreadyCanceled = Object.assign(new Error('already canceled'), {
      type: 'StripeInvalidRequestError',
      code: 'payment_intent_unexpected_state',
      payment_intent: { id: 'pi_1', status: 'canceled' },
    });

    expect(await refusedCancel(alreadyCanceled)).toBe('released');
  });

  it('answers gone for an intent captured before the cancellation', async () => {
    const captured = Object.assign(new Error('captured'), {
      type: 'StripeInvalidRequestError',
      code: 'payment_intent_unexpected_state',
      payment_intent: { id: 'pi_1', status: 'succeeded' },
    });

    expect(await refusedCancel(captured)).toBe('gone');
  });

  it('answers gone for an intent Stripe does not know', async () => {
    const missing = Object.assign(new Error('No such payment_intent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' });

    expect(await refusedCancel(missing)).toBe('gone');
  });

  it.each([
    ['a connection error', Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' })],
    ['a Stripe outage', Object.assign(new Error('internal'), { type: 'StripeAPIError' })],
    ['a rate limit', Object.assign(new Error('too many'), { type: 'StripeRateLimitError', code: 'rate_limit' })],
    ['something that is not an object', 'boom'],
  ])('answers failed, to retry, for %s', async (_case, error) => {
    expect(await refusedCancel(error)).toBe('failed');
  });

  describe('capture', () => {
    const capture = { sessionId: 'session-1', paymentIntentId: 'pi_1', amountCents: 975 };

    it('takes the exact amount once per session, the rest of the hold being released by Stripe', async () => {
      const { stripe, capture: stripeCapture } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));

      expect(await new StripePaymentAuthorizer(stripe).capture(capture)).toEqual({ outcome: 'captured', amountCents: 975 });
      expect(stripeCapture).toHaveBeenCalledWith('pi_1', { amount_to_capture: 975 }, { idempotencyKey: 'exit-session-1-975' });
    });

    it('answers what an intent already captured really took, not the amount asked now', async () => {
      const { stripe, capture: stripeCapture } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));
      stripeCapture.mockRejectedValue({ code: 'payment_intent_unexpected_state', payment_intent: { status: 'succeeded', amount_received: 975 } });

      expect(await new StripePaymentAuthorizer(stripe).capture({ ...capture, amountCents: 1050 })).toEqual({ outcome: 'captured', amountCents: 975 });
    });

    it('waits and replays the first capture when a tap racing it finds the idempotency key in use', async () => {
      const { stripe, capture: stripeCapture } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));
      stripeCapture.mockRejectedValueOnce({ code: 'idempotency_key_in_use' }).mockResolvedValueOnce({ amount_received: 975 });

      expect(await new StripePaymentAuthorizer(stripe, 0).capture(capture)).toEqual({ outcome: 'captured', amountCents: 975 });
      expect(stripeCapture).toHaveBeenCalledTimes(2);
    });

    it('answers failed when the key stays in use after the wait', async () => {
      const { stripe, capture: stripeCapture } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));
      stripeCapture.mockRejectedValue({ code: 'idempotency_key_in_use' });

      expect(await new StripePaymentAuthorizer(stripe, 0).capture(capture)).toEqual({ outcome: 'failed' });
    });

    it.each([
      { cause: 'Stripe is unreachable', error: new Error('network down') },
      { cause: 'the intent was canceled', error: { code: 'payment_intent_unexpected_state', payment_intent: { status: 'canceled' } } },
    ])('answers failed when $cause, without throwing', async ({ error }) => {
      const { stripe, capture: stripeCapture } = fakeStripe(Promise.resolve({ id: 'pi_1', status: 'requires_capture' }));
      stripeCapture.mockRejectedValue(error);

      expect(await new StripePaymentAuthorizer(stripe).capture(capture)).toEqual({ outcome: 'failed' });
    });
  });
});

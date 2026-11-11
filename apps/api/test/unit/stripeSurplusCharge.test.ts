import { describe, expect, it } from 'vitest';
import { StripePaymentAuthorizer } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';
import { ENTRY_CREATED, fakeStripe, surplusIntent } from './fakes/fakeStripeIntents.ts';

describe('StripePaymentAuthorizer.chargeSurplus', () => {
  const surplus = { sessionId: 'session-1', paymentIntentId: 'pi_1', amountCents: 1800 };

  it('charges the entry card off session toward the same operator account, once per session', async () => {
    const { stripe, create, retrieve } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'charged', amountCents: 1800 });
    expect(retrieve).toHaveBeenCalledWith('pi_1');
    expect(create).toHaveBeenCalledWith(
      {
        amount: 1800,
        currency: 'cad',
        customer: 'cus_julie',
        payment_method: 'pm_julie',
        confirm: true,
        off_session: true,
        error_on_requires_action: true,
        metadata: { sessionId: 'session-1', kind: 'surplus' },
        transfer_data: { destination: 'acct_1Lavoie' },
      },
      { idempotencyKey: 'exit-extra-session-1' },
    );
  });

  it('keeps the charge on the platform when the entry had no operator account', async () => {
    const { stripe, create, retrieve } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));
    retrieve.mockResolvedValue({ created: ENTRY_CREATED, customer: 'cus_julie', payment_method: 'pm_julie' });

    await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus);

    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('transfer_data');
  });

  it.each(['requires_action', 'requires_payment_method'])('answers declined for a charge left in %s', async (status) => {
    const { stripe } = fakeStripe(Promise.resolve({ id: 'pi_2', status }));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'declined' });
  });

  it('answers declined when the card refuses, without throwing', async () => {
    const { stripe } = fakeStripe(Promise.reject(Object.assign(new Error('declined'), { type: 'StripeCardError' })));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'declined' });
  });

  it("looks for the session's surplus among the customer's intents since the entry", async () => {
    const { stripe, list } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));

    await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus);

    expect(list).toHaveBeenCalledWith({ customer: 'cus_julie', created: { gte: ENTRY_CREATED }, limit: 100 });
  });

  it('answers what an earlier tap charged, without charging again, when a later tap asks another amount', async () => {
    const { stripe, create, list } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));
    list.mockResolvedValue({ data: [surplusIntent('session-0', 'succeeded', 900), surplusIntent('session-1', 'succeeded', 1725)] });

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'charged', amountCents: 1725 });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers declined, without charging again, when an earlier tap was refused', async () => {
    const { stripe, create, list } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));
    list.mockResolvedValue({ data: [surplusIntent('session-1', 'requires_payment_method', 0)] });

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'declined' });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers the charge Stripe took when the answer timed out', async () => {
    const { stripe, list } = fakeStripe(Promise.reject(new Error('Request timed out')));
    list.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [surplusIntent('session-1', 'succeeded', 1800)] });

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'charged', amountCents: 1800 });
  });

  it('waits for a concurrent tap holding the key, then answers its charge', async () => {
    const { stripe, list } = fakeStripe(Promise.reject(Object.assign(new Error('in use'), { code: 'idempotency_key_in_use' })));
    list.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [surplusIntent('session-1', 'succeeded', 1800)] });

    expect(await new StripePaymentAuthorizer(stripe, 0).chargeSurplus(surplus)).toEqual({ outcome: 'charged', amountCents: 1800 });
  });

  it('answers failed, so the charge is retried, when Stripe errs and no charge of the session exists', async () => {
    const { stripe } = fakeStripe(Promise.reject(new Error('Stripe unreachable')));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'failed' });
  });

  it('answers failed while the charge of the session is still processing', async () => {
    const { stripe, list } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));
    list.mockResolvedValue({ data: [surplusIntent('session-1', 'processing', 0)] });

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'failed' });
  });

  it('answers failed when the entry authorization cannot be read', async () => {
    const { stripe, retrieve, create } = fakeStripe(Promise.resolve({ id: 'pi_2', status: 'succeeded' }));
    retrieve.mockRejectedValue(new Error('Stripe unreachable'));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'failed' });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers declined, not pending forever, when Stripe refuses the request itself', async () => {
    const { stripe } = fakeStripe(Promise.reject(Object.assign(new Error('No such PaymentMethod'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })));

    expect(await new StripePaymentAuthorizer(stripe).chargeSurplus(surplus)).toEqual({ outcome: 'declined' });
  });

  it('answers failed when the key stays in use and no charge of the session shows yet', async () => {
    const { stripe } = fakeStripe(
      Promise.reject(Object.assign(new Error('in use'), { type: 'StripeInvalidRequestError', code: 'idempotency_key_in_use' })),
    );

    expect(await new StripePaymentAuthorizer(stripe, 0).chargeSurplus(surplus)).toEqual({ outcome: 'failed' });
  });
});

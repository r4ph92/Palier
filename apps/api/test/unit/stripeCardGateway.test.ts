import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { CardProviderUnavailableError } from '../../src/domain/payments/CardGateway.ts';
import { StripeCardGateway } from '../../src/infrastructure/stripe/StripeCardGateway.ts';
import { julie } from './fakeDriverRepository.ts';

function gatewayWith(
  paymentMethods: { retrieve: (id: string) => Promise<unknown> },
  customers: { create: (params: unknown) => Promise<unknown> } = { create: () => Promise.resolve({ id: 'cus_1' }) },
) {
  return new StripeCardGateway({ paymentMethods, customers } as unknown as Stripe);
}

describe('StripeCardGateway', () => {
  it('reads the card brand, last four digits and customer from a payment method', async () => {
    const gateway = gatewayWith({
      retrieve: () => Promise.resolve({ type: 'card', card: { brand: 'visa', last4: '4242' }, customer: 'cus_julie' }),
    });

    expect(await gateway.findCardPaymentMethod('pm_visa')).toEqual({ customerId: 'cus_julie', brand: 'visa', last4: '4242' });
  });

  it('reads the customer id when Stripe expands the customer object', async () => {
    const gateway = gatewayWith({
      retrieve: () => Promise.resolve({ card: { brand: 'mastercard', last4: '4444' }, customer: { id: 'cus_julie' } }),
    });

    expect((await gateway.findCardPaymentMethod('pm_mastercard'))?.customerId).toBe('cus_julie');
  });

  it('reports a payment method that does not exist as null, instead of failing', async () => {
    const gateway = gatewayWith({
      retrieve: () => Promise.reject(Object.assign(new Error('No such payment_method'), { code: 'resource_missing' })),
    });

    expect(await gateway.findCardPaymentMethod('pm_gone')).toBeNull();
  });

  it('turns any other Stripe failure into the fixed unavailable error, without Stripe’s text', async () => {
    const gateway = gatewayWith({ retrieve: () => Promise.reject(new Error('Rate limit exceeded: stripe.com/docs')) });

    const failure = gateway.findCardPaymentMethod('pm_visa');

    await expect(failure).rejects.toBeInstanceOf(CardProviderUnavailableError);
    await expect(failure).rejects.toMatchObject({ statusCode: 503, message: 'Card payments are unavailable right now.' });
  });

  it('creates the customer with the driver’s name and id, and never an email', async () => {
    const created: unknown[] = [];
    const gateway = gatewayWith(
      { retrieve: () => Promise.resolve({}) },
      {
        create: (params: unknown) => {
          created.push(params);
          return Promise.resolve({ id: 'cus_new' });
        },
      },
    );

    expect(await gateway.createCustomer(julie)).toBe('cus_new');
    expect(created).toEqual([{ name: 'Julie Tremblay', metadata: { driverId: julie.id } }]);
  });
});

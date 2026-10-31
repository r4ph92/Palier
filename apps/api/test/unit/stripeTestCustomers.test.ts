import { describe, expect, it } from 'vitest';
import { driverPersonas, type DriverPersona } from '../../src/seed/fixtures/drivers.ts';
import { stripeTestKey } from '../../src/config/stripeTestKey.ts';
import { createStripeTestCustomers, type StripeTestApi } from '../../src/seed/stripeTestCustomers.ts';

class FakeStripe implements StripeTestApi {
  readonly customersByEmail = new Map<string, string>();
  readonly cardsByCustomer = new Map<string, { id: string; card: { brand: string; last4: string } }>();
  createdCustomers = 0;
  attachedCards = 0;

  readonly customers = {
    list: ({ email }: { email: string }) => Promise.resolve(listOf(customerWithId(this.customersByEmail.get(email)))),
    create: ({ email }: { email: string }) => {
      this.createdCustomers += 1;
      const id = `cus_${this.createdCustomers}`;
      this.customersByEmail.set(email, id);
      return Promise.resolve({ id });
    },
  };

  readonly paymentMethods = {
    list: ({ customer }: { customer: string }) => Promise.resolve(listOf(this.cardsByCustomer.get(customer))),
    attach: (_paymentMethod: string, { customer }: { customer: string }) => {
      this.attachedCards += 1;
      const card = { id: `pm_${this.attachedCards}`, card: { brand: 'visa', last4: '4242' } };
      this.cardsByCustomer.set(customer, card);
      return Promise.resolve(card);
    },
  };
}

function customerWithId(id: string | undefined) {
  return id === undefined ? undefined : { id };
}

function listOf<T>(card: T | undefined) {
  return { data: card === undefined ? [] : [card] };
}

const julie = driverPersonas[0] as DriverPersona;
const nadia = driverPersonas[2] as DriverPersona;

describe('stripeTestKey', () => {
  it('is null when no key is set, so the seed runs without Stripe', () => {
    expect(stripeTestKey({})).toBeNull();
    expect(stripeTestKey({ STRIPE_SECRET_KEY: '' })).toBeNull();
  });

  it('accepts a test key', () => {
    expect(stripeTestKey({ STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('sk_test_abc');
  });

  it('refuses a live key', () => {
    expect(() => stripeTestKey({ STRIPE_SECRET_KEY: 'sk_live_abc' })).toThrow(/test key/);
  });
});

describe('createStripeTestCustomers', () => {
  it('creates a customer with a saved card for a persona that has one', async () => {
    const stripe = new FakeStripe();

    const ids = await createStripeTestCustomers(stripe, [julie]);

    expect(ids.get(julie.user.email)).toEqual({ stripeCustomerId: 'cus_1', defaultPmId: 'pm_1', cardBrand: 'visa', cardLast4: '4242' });
  });

  it('creates a customer without a card for a persona that has none', async () => {
    const stripe = new FakeStripe();

    const ids = await createStripeTestCustomers(stripe, [nadia]);

    expect(ids.get(nadia.user.email)).toEqual({ stripeCustomerId: 'cus_1', defaultPmId: null, cardBrand: null, cardLast4: null });
    expect(stripe.attachedCards).toBe(0);
  });

  it('reuses the customer and card of an earlier seed', async () => {
    const stripe = new FakeStripe();
    await createStripeTestCustomers(stripe, [julie]);

    const ids = await createStripeTestCustomers(stripe, [julie]);

    expect(ids.get(julie.user.email)).toEqual({ stripeCustomerId: 'cus_1', defaultPmId: 'pm_1', cardBrand: 'visa', cardLast4: '4242' });
    expect(stripe.createdCustomers).toBe(1);
    expect(stripe.attachedCards).toBe(1);
  });
});

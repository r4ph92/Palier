import type { DriverPersona } from './fixtures/drivers.ts';

export interface StripeIds {
  readonly stripeCustomerId: string;
  readonly defaultPmId: string | null;
}

interface StripeObject {
  readonly id: string;
}

interface StripeList {
  readonly data: readonly StripeObject[];
}

// The part of the Stripe client the seeder uses, so tests can pass a fake.
export interface StripeTestApi {
  readonly customers: {
    list(params: { email: string; limit: number }): Promise<StripeList>;
    create(params: { email: string; name: string }): Promise<StripeObject>;
  };
  readonly paymentMethods: {
    list(params: { customer: string; type: 'card'; limit: number }): Promise<StripeList>;
    attach(paymentMethod: string, params: { customer: string }): Promise<StripeObject>;
  };
}

export async function createStripeTestCustomers(
  stripe: StripeTestApi,
  personas: readonly DriverPersona[],
): Promise<ReadonlyMap<string, StripeIds>> {
  const stripeIds = new Map<string, StripeIds>();
  for (const persona of personas) {
    stripeIds.set(persona.user.email, await stripeIdsFor(stripe, persona));
  }
  return stripeIds;
}

// Reuses the customer and card of an earlier seed so reseeding does not pile up test customers.
async function stripeIdsFor(stripe: StripeTestApi, persona: DriverPersona): Promise<StripeIds> {
  const { email, firstName, lastName } = persona.user;
  const existing = (await stripe.customers.list({ email, limit: 1 })).data[0];
  const customer = existing ?? (await stripe.customers.create({ email, name: `${firstName} ${lastName}` }));
  return { stripeCustomerId: customer.id, defaultPmId: await defaultCardId(stripe, customer.id, persona.testPaymentMethod) };
}

async function defaultCardId(stripe: StripeTestApi, customer: string, testPaymentMethod: string | null): Promise<string | null> {
  if (testPaymentMethod === null) {
    return null;
  }
  const existing = (await stripe.paymentMethods.list({ customer, type: 'card', limit: 1 })).data[0];
  const card = existing ?? (await stripe.paymentMethods.attach(testPaymentMethod, { customer }));
  return card.id;
}

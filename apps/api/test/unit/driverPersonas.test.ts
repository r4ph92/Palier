import { describe, expect, it } from 'vitest';
import { driverPersonas } from '../../src/seed/fixtures/drivers.ts';

function personaNamed(firstName: string) {
  const persona = driverPersonas.find((candidate) => candidate.user.firstName === firstName);
  if (persona === undefined) {
    throw new Error(`no seeded persona named ${firstName}`);
  }
  return persona;
}

describe('seeded driver personas', () => {
  it('has a unique id and email for every persona', () => {
    const ids = new Set(driverPersonas.map((persona) => persona.user.id));
    const emails = new Set(driverPersonas.map((persona) => persona.user.email));

    expect(ids.size).toBe(driverPersonas.length);
    expect(emails.size).toBe(driverPersonas.length);
  });

  it('gives Amélie a Visa and Éric a card whose charges fail', () => {
    expect(personaNamed('Amélie').testPaymentMethod).toBe('pm_card_visa');
    expect(personaNamed('Éric').testPaymentMethod).toBe('pm_card_chargeCustomerFail');
  });
});

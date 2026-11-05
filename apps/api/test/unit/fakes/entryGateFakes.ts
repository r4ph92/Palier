import type { EntryPolicy } from '../../../src/domain/entries/EntryEligibility.ts';
import type { EntryGate, EntryGateRepository } from '../../../src/domain/entries/EntryGateRepository.ts';
import { entreeDemo, sortieDemo } from './gateFixtures.ts';

export const ENTREE_DEMO_SECRET = 'uC_Nt1LDTNCeYZC9i6ENFZifPf953v6Hz2vMWeBf2a4';
export const SORTIE_DEMO_SECRET = 'pW-gxvykdybxjEOP6ebx6mGn6K21E1Iu9biLvAvAicQ';
export const ENTREE_ROY_SECRET = 'Qw34Ic7nOubM0aZdCa0HXmkLJ2kxp2hHq8HBd6unq14';
export const LAVOIE_ACCOUNT = 'acct_1Lavoie';

// Outside demo mode: a lot whose operator has no Stripe account takes no entry and no hold.
export const STRICT_POLICY: EntryPolicy = { allowPlatformChargesWithoutOperatorAccount: false };
export const PARKING_DEMO_POLICY = { incrementCents: 75, incrementMinutes: 15, holdQuota: 3 };
const parkingDemoLot = {
  id: entreeDemo.lotId,
  isOnline: true,
  dailyCapCents: 2500,
  pricingPolicy: PARKING_DEMO_POLICY,
  capacity: 10,
  vehicleCount: 0,
  heldSpotCount: 0,
  operatorStripeAccountId: LAVOIE_ACCOUNT,
};

export const entreeDemoGate: EntryGate = {
  id: entreeDemo.id,
  kind: 'ENTRY',
  integrationKind: 'SIMULATED',
  qrSecret: ENTREE_DEMO_SECRET,
  lot: parkingDemoLot,
};
export const sortieDemoGate: EntryGate = { ...entreeDemoGate, id: sortieDemo.id, kind: 'EXIT', qrSecret: SORTIE_DEMO_SECRET };
export const entreeRoyGate: EntryGate = {
  id: '00000000-0000-4000-8000-000000000703',
  kind: 'ENTRY',
  integrationKind: 'DRY_CONTACT',
  qrSecret: ENTREE_ROY_SECRET,
  lot: {
    id: '00000000-0000-4000-8000-000000000202',
    isOnline: false,
    dailyCapCents: 2500,
    pricingPolicy: PARKING_DEMO_POLICY,
    capacity: 10,
    vehicleCount: 0,
    heldSpotCount: 0,
    operatorStripeAccountId: null,
  },
};

export class FakeEntryGateRepository implements EntryGateRepository {
  readonly #gates: Map<string, EntryGate>;

  constructor(gates: readonly EntryGate[] = [entreeDemoGate, sortieDemoGate, entreeRoyGate]) {
    this.#gates = new Map(gates.map((gate) => [gate.id, gate]));
  }

  findGate(gateId: string): Promise<EntryGate | null> {
    return Promise.resolve(this.#gates.get(gateId) ?? null);
  }
}

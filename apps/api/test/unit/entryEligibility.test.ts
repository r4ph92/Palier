import { describe, expect, it } from 'vitest';
import type { EntryRefusalCode } from '@palier/shared-types';
import { EntryEligibility } from '../../src/domain/entries/EntryEligibility.ts';
import type { EntryPolicy } from '../../src/domain/payments/EntryPolicy.ts';
import type { EntryGate } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { PricingPolicyInvalidError } from '../../src/domain/pricing/PricingPolicy.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import type { VehicleNeeds } from '../../src/domain/vehicles/VehicleRepository.ts';
import { FakeVehicleRepository, standardNeeds } from './fakeVehicleRepository.ts';
import {
  ENTREE_DEMO_SECRET,
  ENTREE_ROY_SECRET,
  entreeDemoGate,
  entreeRoyGate,
  FakeEntryGateRepository,
  LAVOIE_ACCOUNT,
  SORTIE_DEMO_SECRET,
  sortieDemoGate,
} from './fakes/entryFakes.ts';
import { STRICT_POLICY } from './fakes/entryGateFakes.ts';
import { FakeSpotHoldRepository } from './fakes/fakeSpotHolds.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

interface Setup {
  readonly gates?: readonly EntryGate[];
  readonly holds?: readonly { lotId: string; expiresAt: Date }[];
  readonly policy?: EntryPolicy;
  readonly plate?: boolean;
  readonly card?: boolean;
  readonly needs?: VehicleNeeds;
}

async function eligibilityFor({ gates: gateList, holds = [], policy = STRICT_POLICY, plate = true, card = true, needs = standardNeeds }: Setup = {}) {
  const drivers = new FakeDriverRepository();
  const vehicles = new FakeVehicleRepository();
  const spotHolds = new FakeSpotHoldRepository();
  holds.forEach(({ lotId, expiresAt }) => spotHolds.seed(julie.id, { id: 'hold-1', lotId, lotName: 'Parking Démo', expiresAt }));
  if (plate) {
    await vehicles.saveVehicle(julie.id, { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC', ...needs });
  }
  if (card) {
    await drivers.saveStripeCustomerIdIfMissing(julie.id, 'cus_julie');
    await drivers.saveSavedCard(julie.id, 'pm_julie', { brand: 'visa', last4: '4242' });
  }
  return new EntryEligibility({ gates: new FakeEntryGateRepository(gateList), vehicles, drivers, policy, spotHolds });
}

async function refusalOf(eligibility: EntryEligibility, qrContent: string): Promise<EntryRefusalCode | undefined> {
  const error: unknown = await eligibility.check({ driverId: julie.id, qrContent, now: NOW }).catch((caught: unknown) => caught);
  return error instanceof Error && 'reason' in error ? (error.reason as EntryRefusalCode) : undefined;
}

describe('entry eligibility', () => {
  it('answers what the admission needs for Julie at Entrée Démo', async () => {
    const eligibility = await eligibilityFor();

    const eligible = await eligibility.check({ driverId: julie.id, qrContent: entreeDemoQr, now: NOW });

    expect(eligible).toEqual({
      driverId: julie.id,
      now: NOW,
      gate: { id: entreeDemoGate.id, lotId: entreeDemoGate.lot.id },
      vehicle: { id: expect.any(String), plate: 'ABC 123', needs: standardNeeds },
      payment: { customerId: 'cus_julie', paymentMethodId: 'pm_julie', amountCents: 2500, destinationAccountId: LAVOIE_ACCOUNT },
      pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
    });
  });

  it.each([
    ['no pricing policy', null],
    ['a policy without an increment length', { incrementCents: 75 }],
  ])('refuses a lot with %s as LOT_NOT_IN_SERVICE, with the pricing error as cause', async (_case, pricingPolicy) => {
    const unpriced = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, pricingPolicy } };
    const eligibility = await eligibilityFor({ gates: [unpriced] });

    const refusal: unknown = await eligibility.check({ driverId: julie.id, qrContent: entreeDemoQr, now: NOW }).catch((caught: unknown) => caught);

    expect(refusal).toMatchObject({ reason: 'LOT_NOT_IN_SERVICE' });
    expect((refusal as Error).cause).toBeInstanceOf(PricingPolicyInvalidError);
    expect((refusal as Error).cause).toMatchObject({ lotId: entreeDemoGate.lot.id });
  });

  it.each([
    ['an unknown gate', gateQrLink('00000000-0000-4000-8000-000000000799', ENTREE_DEMO_SECRET)],
    ['a gate signed with another secret', gateQrLink(entreeDemoGate.id, SORTIE_DEMO_SECRET)],
    ['text that is no token', 'bonjour'],
  ])('refuses %s as QR_NOT_RECOGNIZED', async (_case, qrContent) => {
    expect(await refusalOf(await eligibilityFor(), qrContent)).toBe('QR_NOT_RECOGNIZED');
  });

  it('carries the needs declared on the default vehicle to the admission', async () => {
    const needs = { isElectric: true, hasAccessiblePermit: true, isOversize: false };
    const eligibility = await eligibilityFor({ needs });

    const eligible = await eligibility.check({ driverId: julie.id, qrContent: entreeDemoQr, now: NOW });

    expect(eligible.vehicle.needs).toEqual(needs);
  });

  it('refuses a gate without QR secret as QR_NOT_RECOGNIZED', async () => {
    const eligibility = await eligibilityFor({ gates: [{ ...entreeDemoGate, qrSecret: null }] });

    expect(await refusalOf(eligibility, entreeDemoQr)).toBe('QR_NOT_RECOGNIZED');
  });

  it('refuses the exit gate as NOT_AN_ENTRY_GATE', async () => {
    expect(await refusalOf(await eligibilityFor(), gateQrLink(sortieDemoGate.id, SORTIE_DEMO_SECRET))).toBe('NOT_AN_ENTRY_GATE');
  });

  it('refuses Entrée Roy, offline and wired by dry contact, as LOT_NOT_IN_SERVICE', async () => {
    expect(await refusalOf(await eligibilityFor(), gateQrLink(entreeRoyGate.id, ENTREE_ROY_SECRET))).toBe('LOT_NOT_IN_SERVICE');
  });

  it('refuses an online gate Palier cannot command as GATE_UNAVAILABLE', async () => {
    const eligibility = await eligibilityFor({ gates: [{ ...entreeDemoGate, integrationKind: 'DRY_CONTACT' }] });

    expect(await refusalOf(eligibility, entreeDemoQr)).toBe('GATE_UNAVAILABLE');
  });

  it('refuses a lot whose operator has no Stripe account as OPERATOR_NOT_PAYABLE', async () => {
    const unpayable = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, operatorStripeAccountId: null } };

    expect(await refusalOf(await eligibilityFor({ gates: [unpayable] }), entreeDemoQr)).toBe('OPERATOR_NOT_PAYABLE');
  });

  it('refuses a lot whose vehicles fill its capacity as LOT_FULL', async () => {
    const full = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 10 } };

    expect(await refusalOf(await eligibilityFor({ gates: [full] }), entreeDemoQr)).toBe('LOT_FULL');
  });

  it('refuses a lot whose vehicles and held spots fill its capacity as LOT_FULL', async () => {
    const heldFull = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 7, heldSpotCount: 3 } };

    expect(await refusalOf(await eligibilityFor({ gates: [heldFull] }), entreeDemoQr)).toBe('LOT_FULL');
  });

  describe('a driver holding a spot in a full lot', () => {
    const heldFull = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 9, heldSpotCount: 1 } };
    const hold = (lotId: string, expiresAt: Date) => ({ lotId, expiresAt });

    it('is admitted, her hold being her room', async () => {
      const holds = [hold(entreeDemoGate.lot.id, new Date('2026-11-05T12:10:00Z'))];

      expect(await refusalOf(await eligibilityFor({ gates: [heldFull], holds }), entreeDemoQr)).toBeUndefined();
    });

    it('is refused LOT_FULL once her hold is past its end, even if the job has not ended it', async () => {
      const holds = [hold(entreeDemoGate.lot.id, new Date('2026-11-05T11:59:00Z'))];

      expect(await refusalOf(await eligibilityFor({ gates: [heldFull], holds }), entreeDemoQr)).toBe('LOT_FULL');
    });

    it('is refused LOT_FULL when her hold is in another lot', async () => {
      const holds = [hold('00000000-0000-4000-8000-000000000299', new Date('2026-11-05T12:10:00Z'))];

      expect(await refusalOf(await eligibilityFor({ gates: [heldFull], holds }), entreeDemoQr)).toBe('LOT_FULL');
    });
  });

  it('admits a driver into a lot with one vehicle space left', async () => {
    const almostFull = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 9 } };

    expect(await refusalOf(await eligibilityFor({ gates: [almostFull] }), entreeDemoQr)).toBeUndefined();
  });

  it('lets the hold stay on the platform in demo mode when the operator has no Stripe account', async () => {
    const unpayable = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, operatorStripeAccountId: null } };
    const policy = { allowPlatformChargesWithoutOperatorAccount: true };

    const eligible = await (await eligibilityFor({ gates: [unpayable], policy })).check({ driverId: julie.id, qrContent: entreeDemoQr, now: NOW });

    expect(eligible.payment.destinationAccountId).toBeNull();
  });

  it.each([
    ['no plate and no card', { plate: false, card: false }],
    ['a card but no plate', { plate: false }],
    ['a plate but no card', { card: false }],
  ])('refuses a driver with %s as PREREQUISITES_MISSING', async (_case, setup) => {
    expect(await refusalOf(await eligibilityFor(setup), entreeDemoQr)).toBe('PREREQUISITES_MISSING');
  });

  it('checks the gate before the driver: Nadia at the exit gate hears about the gate', async () => {
    const eligibility = await eligibilityFor({ plate: false, card: false });

    expect(await refusalOf(eligibility, gateQrLink(sortieDemoGate.id, SORTIE_DEMO_SECRET))).toBe('NOT_AN_ENTRY_GATE');
  });

  it('checks the lot before the integration: an offline lot with a dry-contact gate is not in service', async () => {
    const offline = { ...entreeDemoGate, integrationKind: 'DRY_CONTACT' as const, lot: { ...entreeDemoGate.lot, isOnline: false } };

    expect(await refusalOf(await eligibilityFor({ gates: [offline] }), entreeDemoQr)).toBe('LOT_NOT_IN_SERVICE');
  });

  it('checks the lot terms before the integration: an unpayable lot with a dry-contact gate names the operator', async () => {
    const unpayable = { ...entreeDemoGate, integrationKind: 'DRY_CONTACT' as const, lot: { ...entreeDemoGate.lot, operatorStripeAccountId: null } };

    expect(await refusalOf(await eligibilityFor({ gates: [unpayable] }), entreeDemoQr)).toBe('OPERATOR_NOT_PAYABLE');
  });

  it('checks the lot terms before the room: a full lot without a readable price is not in service', async () => {
    const fullUnpriced = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 10, pricingPolicy: null } };

    expect(await refusalOf(await eligibilityFor({ gates: [fullUnpriced] }), entreeDemoQr)).toBe('LOT_NOT_IN_SERVICE');
  });
});

import { describe, expect, it } from 'vitest';
import type { EntryRefusalCode } from '@palier/shared-types';
import { EntryEligibility, type EntryPolicy } from '../../src/domain/entries/EntryEligibility.ts';
import type { EntryGate } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
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

const STRICT: EntryPolicy = { allowPlatformChargesWithoutOperatorAccount: false };
const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

interface Setup {
  readonly gates?: readonly EntryGate[];
  readonly policy?: EntryPolicy;
  readonly plate?: boolean;
  readonly card?: boolean;
}

async function eligibilityFor({ gates, policy = STRICT, plate = true, card = true }: Setup = {}) {
  const drivers = new FakeDriverRepository();
  const vehicles = new FakeVehicleRepository();
  if (plate) {
    await vehicles.saveVehicle(julie.id, { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC' });
  }
  if (card) {
    await drivers.saveStripeCustomerIdIfMissing(julie.id, 'cus_julie');
    await drivers.saveSavedCard(julie.id, 'pm_julie', { brand: 'visa', last4: '4242' });
  }
  return new EntryEligibility({ gates: new FakeEntryGateRepository(gates), vehicles, drivers, policy });
}

async function refusalOf(eligibility: EntryEligibility, qrContent: string): Promise<EntryRefusalCode | undefined> {
  const error: unknown = await eligibility.check({ driverId: julie.id, qrContent }).catch((caught: unknown) => caught);
  return error instanceof Error && 'reason' in error ? (error.reason as EntryRefusalCode) : undefined;
}

describe('entry eligibility', () => {
  it('answers what the admission needs for Julie at Entrée Démo', async () => {
    const eligibility = await eligibilityFor();

    const eligible = await eligibility.check({ driverId: julie.id, qrContent: entreeDemoQr });

    expect(eligible).toEqual({
      driverId: julie.id,
      gate: { id: entreeDemoGate.id, lotId: entreeDemoGate.lot.id },
      vehicle: { id: expect.any(String), plate: 'ABC 123' },
      payment: { customerId: 'cus_julie', paymentMethodId: 'pm_julie', amountCents: 2500, destinationAccountId: LAVOIE_ACCOUNT },
    });
  });

  it.each([
    ['an unknown gate', gateQrLink('00000000-0000-4000-8000-000000000799', ENTREE_DEMO_SECRET)],
    ['a gate signed with another secret', gateQrLink(entreeDemoGate.id, SORTIE_DEMO_SECRET)],
    ['text that is no token', 'bonjour'],
  ])('refuses %s as QR_NOT_RECOGNIZED', async (_case, qrContent) => {
    expect(await refusalOf(await eligibilityFor(), qrContent)).toBe('QR_NOT_RECOGNIZED');
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

  it('admits a driver into a lot with one vehicle space left', async () => {
    const almostFull = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 9 } };

    expect(await refusalOf(await eligibilityFor({ gates: [almostFull] }), entreeDemoQr)).toBeUndefined();
  });

  it('lets the hold stay on the platform in demo mode when the operator has no Stripe account', async () => {
    const unpayable = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, operatorStripeAccountId: null } };
    const policy = { allowPlatformChargesWithoutOperatorAccount: true };

    const eligible = await (await eligibilityFor({ gates: [unpayable], policy })).check({ driverId: julie.id, qrContent: entreeDemoQr });

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
});

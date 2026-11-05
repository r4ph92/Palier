import { describe, expect, it } from 'vitest';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import type { EntryPolicy } from '../../src/domain/payments/EntryPolicy.ts';
import { PricingPolicyInvalidError } from '../../src/domain/pricing/PricingPolicy.ts';
import { SpotHoldEligibility } from '../../src/domain/spotHolds/SpotHoldEligibility.ts';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldLot } from '../../src/domain/spotHolds/SpotHoldRepository.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository, standardNeeds } from './fakeVehicleRepository.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { STRICT_POLICY } from './fakes/entryGateFakes.ts';
import { FakeSpotHoldRepository, parkingDemoSpotHoldLot } from './fakes/fakeSpotHolds.ts';

const UNKNOWN_LOT_ID = '00000000-0000-4000-8000-000000000299';

interface Setup {
  readonly plate?: boolean;
  readonly card?: boolean;
  readonly lots?: readonly SpotHoldLot[];
  readonly policy?: EntryPolicy;
}

async function eligibilityFor({ plate = true, card = true, lots, policy = STRICT_POLICY }: Setup = {}) {
  const drivers = new FakeDriverRepository();
  const vehicles = new FakeVehicleRepository();
  const spotHolds = new FakeSpotHoldRepository(lots);
  if (plate) {
    await vehicles.saveVehicle(julie.id, { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC', ...standardNeeds });
  }
  if (card) {
    await drivers.saveStripeCustomerIdIfMissing(julie.id, 'cus_julie');
    await drivers.saveSavedCard(julie.id, 'pm_julie', { brand: 'visa', last4: '4242' });
  }
  return { spotHolds, eligibility: new SpotHoldEligibility({ prerequisites: { vehicles, drivers }, spotHolds, policy }) };
}

async function refusalOf(eligibility: SpotHoldEligibility, lotId = PARKING_DEMO_ID): Promise<SpotHoldRefusedError | undefined> {
  const error: unknown = await eligibility.check({ driverId: julie.id, lotId }).catch((caught: unknown) => caught);
  return error instanceof SpotHoldRefusedError ? error : undefined;
}

async function reasonOf(setup: Setup, lotId?: string): Promise<SpotHoldRefusalCode | undefined> {
  return (await refusalOf((await eligibilityFor(setup)).eligibility, lotId))?.reason;
}

describe('spot hold eligibility', () => {
  it('answers Julie\'s vehicle needs for a hold at Parking Démo', async () => {
    const { eligibility } = await eligibilityFor();

    expect(await eligibility.check({ driverId: julie.id, lotId: PARKING_DEMO_ID })).toEqual({ driverId: julie.id, lotId: PARKING_DEMO_ID, needs: standardNeeds });
  });

  it.each([
    ['no plate', { plate: false }],
    ['no card', { card: false }],
    ['neither plate nor card', { plate: false, card: false }],
  ])('refuses a driver with %s as PREREQUISITES_MISSING', async (_case, setup: Setup) => {
    expect(await reasonOf(setup)).toBe('PREREQUISITES_MISSING');
  });

  it('refuses a driver who already holds a spot as HOLD_ALREADY_EXISTS', async () => {
    const { eligibility, spotHolds } = await eligibilityFor();
    await spotHolds.placeSpotHold({ driverId: julie.id, lotId: PARKING_DEMO_ID, needs: standardNeeds, createdAt: new Date(), expiresAt: new Date() });

    expect((await refusalOf(eligibility))?.reason).toBe('HOLD_ALREADY_EXISTS');
  });

  it('refuses missing prerequisites before looking at the lot', async () => {
    expect(await reasonOf({ plate: false }, UNKNOWN_LOT_ID)).toBe('PREREQUISITES_MISSING');
  });

  it('refuses an unknown lot id as LOT_NOT_FOUND', async () => {
    expect(await reasonOf({}, UNKNOWN_LOT_ID)).toBe('LOT_NOT_FOUND');
  });

  it('refuses an offline lot as LOT_NOT_IN_SERVICE', async () => {
    expect(await reasonOf({}, GARAGE_ROY_ID)).toBe('LOT_NOT_IN_SERVICE');
  });

  it('refuses a lot without a usable price as LOT_NOT_IN_SERVICE and keeps the pricing problem as its cause', async () => {
    const { eligibility } = await eligibilityFor({ lots: [{ ...parkingDemoSpotHoldLot, pricingPolicy: null }] });

    const refusal = await refusalOf(eligibility);

    expect(refusal?.reason).toBe('LOT_NOT_IN_SERVICE');
    expect(refusal?.cause).toBeInstanceOf(PricingPolicyInvalidError);
  });

  it('refuses a lot whose operator cannot be paid as LOT_NOT_IN_SERVICE', async () => {
    expect(await reasonOf({ lots: [{ ...parkingDemoSpotHoldLot, operatorStripeAccountId: null }] })).toBe('LOT_NOT_IN_SERVICE');
  });

  it('accepts a lot without an operator account in demo mode, like an entry', async () => {
    const lots = [{ ...parkingDemoSpotHoldLot, operatorStripeAccountId: null }];

    expect(await reasonOf({ lots, policy: { allowPlatformChargesWithoutOperatorAccount: true } })).toBeUndefined();
  });
});

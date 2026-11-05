import { describe, expect, it } from 'vitest';
import { checkLotTerms, type LotTermsInput } from '../../src/domain/lots/lotTerms.ts';
import { PricingPolicyInvalidError } from '../../src/domain/pricing/PricingPolicy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_DEMO_POLICY, STRICT_POLICY } from './fakes/entryGateFakes.ts';

const DEMO_MODE = { allowPlatformChargesWithoutOperatorAccount: true };

const parkingDemo: LotTermsInput = {
  id: PARKING_DEMO_ID,
  isOnline: true,
  pricingPolicy: PARKING_DEMO_POLICY,
  dailyCapCents: 2500,
  operatorStripeAccountId: 'acct_lavoie',
};

describe('checkLotTerms', () => {
  it('accepts an online lot with a price and a payable operator, with its pricing', () => {
    expect(checkLotTerms(parkingDemo, STRICT_POLICY)).toEqual({ accepted: true, pricing: expect.objectContaining({ incrementCents: 75 }) });
  });

  it('refuses an offline lot before anything else', () => {
    expect(checkLotTerms({ ...parkingDemo, isOnline: false, operatorStripeAccountId: null, pricingPolicy: {} }, STRICT_POLICY)).toEqual({
      accepted: false,
      refusal: { kind: 'offline' },
    });
  });

  it('refuses a lot whose operator has no Stripe account outside demo mode', () => {
    const roy = { ...parkingDemo, operatorStripeAccountId: null };

    expect(checkLotTerms(roy, STRICT_POLICY)).toEqual({ accepted: false, refusal: { kind: 'operatorNotPayable' } });
    expect(checkLotTerms(roy, DEMO_MODE).accepted).toBe(true);
  });

  it('refuses a lot whose price cannot be read, keeping the reason', () => {
    const terms = checkLotTerms({ ...parkingDemo, pricingPolicy: { incrementCents: -1 } }, STRICT_POLICY);

    expect(terms.accepted).toBe(false);
    expect(!terms.accepted && terms.refusal.kind === 'pricingInvalid' && terms.refusal.cause).toBeInstanceOf(PricingPolicyInvalidError);
  });
});

import { DAILY_CAP_CENTS_LIMITS, INCREMENT_CENTS_LIMITS } from '@palier/shared-types/lotPricing';
import type { EntryPolicy } from '../payments/EntryPolicy.ts';
import { isOperatorPayable } from '../payments/isOperatorPayable.ts';
import { PricingPolicyInvalidError, readLotPricing, type PricedLot, type PricingPolicy } from '../pricing/PricingPolicy.ts';

export interface LotTermsInput extends PricedLot {
  readonly isOnline: boolean;
  readonly operatorStripeAccountId: string | null;
}

export type LotTermsRefusal =
  | { readonly kind: 'offline' }
  | { readonly kind: 'operatorNotPayable' }
  | { readonly kind: 'pricingInvalid'; readonly cause: PricingPolicyInvalidError };

export type LotTerms = { readonly accepted: true; readonly pricing: PricingPolicy } | { readonly accepted: false; readonly refusal: LotTermsRefusal };

// What a lot itself must offer before it admits a vehicle or promises a spot; each caller names the refusal its own way.
export function checkLotTerms(lot: LotTermsInput, policy: EntryPolicy): LotTerms {
  if (!lot.isOnline) {
    return { accepted: false, refusal: { kind: 'offline' } };
  }
  if (!isOperatorPayable(lot.operatorStripeAccountId, policy)) {
    return { accepted: false, refusal: { kind: 'operatorNotPayable' } };
  }
  const pricing = readLotPricing(lot);
  if (pricing instanceof PricingPolicyInvalidError) {
    return { accepted: false, refusal: { kind: 'pricingInvalid', cause: pricing } };
  }
  if (isAboveTheLargestPrice(pricing)) {
    return { accepted: false, refusal: { kind: 'pricingInvalid', cause: new PricingPolicyInvalidError(lot.id) } };
  }
  return { accepted: true, pricing };
}

// A lot priced before the largest cap went down (#151) holds no card above it: out of service until its operator saves a price again.
function isAboveTheLargestPrice({ incrementCents, dailyCapCents }: PricingPolicy): boolean {
  return incrementCents > INCREMENT_CENTS_LIMITS.maximum || dailyCapCents > DAILY_CAP_CENTS_LIMITS.maximum;
}

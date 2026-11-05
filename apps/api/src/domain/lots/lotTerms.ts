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
  return { accepted: true, pricing };
}

import type { DashboardErrorCode } from './dashboard.ts';
import { fieldErrorsOf, isWholeNumberWithin, type FieldErrors } from './fieldErrors.ts';

// 100 000,00 $: far above any parking day, and far below what int4 columns and Stripe amounts hold.
export const PRICING_MAX_CENTS = 10_000_000;
export const INCREMENT_CENTS_LIMITS = { minimum: 1, maximum: PRICING_MAX_CENTS } as const;
export const INCREMENT_MINUTES_LIMITS = { minimum: 5, maximum: 60 } as const;
// The cap is the amount authorized at entry (Q19), and Stripe refuses a CAD charge under 0,50 $.
export const DAILY_CAP_CENTS_LIMITS = { minimum: 50, maximum: PRICING_MAX_CENTS } as const;
export const HOLD_QUOTA_LIMITS = { minimum: 0, maximum: 50 } as const;

// D1: each started increment costs incrementCents, a day never costs more than dailyCapCents; holdQuota is the lot's guarantees at once.
export interface LotPricing {
  readonly incrementCents: number;
  readonly incrementMinutes: number;
  readonly dailyCapCents: number;
  readonly holdQuota: number;
}

// The form may send no cap: the rule then answers that it is required.
export interface LotPricingRequest extends Omit<LotPricing, 'dailyCapCents'> {
  readonly dailyCapCents: number | null;
}

export type PricingField = keyof LotPricing;

export type PricingErrorCode = Extract<
  DashboardErrorCode,
  | 'PRICING_INCREMENT_CENTS_INVALID'
  | 'PRICING_INCREMENT_MINUTES_INVALID'
  | 'PRICING_DAILY_CAP_REQUIRED'
  | 'PRICING_DAILY_CAP_INVALID'
  | 'PRICING_DAILY_CAP_BELOW_INCREMENT'
  | 'PRICING_HOLD_QUOTA_INVALID'
>;

export type PricingErrors = FieldErrors<PricingField, PricingErrorCode>;

// The one pricing rule, applied by the dashboard before sending and by the API before writing.
export function pricingErrors(pricing: LotPricingRequest): PricingErrors {
  return fieldErrorsOf<PricingField, PricingErrorCode>([
    ['incrementCents', isWholeNumberWithin(pricing.incrementCents, INCREMENT_CENTS_LIMITS) ? null : 'PRICING_INCREMENT_CENTS_INVALID'],
    ['incrementMinutes', isWholeNumberWithin(pricing.incrementMinutes, INCREMENT_MINUTES_LIMITS) ? null : 'PRICING_INCREMENT_MINUTES_INVALID'],
    ['dailyCapCents', dailyCapError(pricing)],
    ['holdQuota', isWholeNumberWithin(pricing.holdQuota, HOLD_QUOTA_LIMITS) ? null : 'PRICING_HOLD_QUOTA_INVALID'],
  ]);
}

function dailyCapError({ dailyCapCents, incrementCents }: LotPricingRequest): PricingErrorCode | null {
  if (dailyCapCents === null) {
    return 'PRICING_DAILY_CAP_REQUIRED';
  }
  if (!isWholeNumberWithin(dailyCapCents, DAILY_CAP_CENTS_LIMITS)) {
    return 'PRICING_DAILY_CAP_INVALID';
  }
  return dailyCapCents < incrementCents ? 'PRICING_DAILY_CAP_BELOW_INCREMENT' : null;
}

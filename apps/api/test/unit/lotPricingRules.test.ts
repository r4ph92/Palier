import { describe, expect, it } from 'vitest';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { pricingErrors, type LotPricingRequest } from '@palier/shared-types/lotPricing';

const royPricing: LotPricingRequest = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };

describe('the pricing rule', () => {
  it('accepts 1,00 $ per 20 minutes, a daily cap of 18,00 $ and a hold quota of 4', () => {
    expect(pricingErrors(royPricing)).toEqual({});
  });

  it('answers that a missing daily cap is required', () => {
    expect(pricingErrors({ ...royPricing, dailyCapCents: null })).toEqual({ dailyCapCents: 'PRICING_DAILY_CAP_REQUIRED' });
  });

  it.each([
    ['a zero increment price', { incrementCents: 0 }, { incrementCents: 'PRICING_INCREMENT_CENTS_INVALID' }],
    ['a negative increment price', { incrementCents: -100 }, { incrementCents: 'PRICING_INCREMENT_CENTS_INVALID' }],
    ['a fractional increment price', { incrementCents: 100.5 }, { incrementCents: 'PRICING_INCREMENT_CENTS_INVALID' }],
    ['a 4-minute increment', { incrementMinutes: 4 }, { incrementMinutes: 'PRICING_INCREMENT_MINUTES_INVALID' }],
    ['a 61-minute increment', { incrementMinutes: 61 }, { incrementMinutes: 'PRICING_INCREMENT_MINUTES_INVALID' }],
    ['a cap under one increment', { dailyCapCents: 50, incrementCents: 100 }, { dailyCapCents: 'PRICING_DAILY_CAP_BELOW_INCREMENT' }],
    ['a cap of 0,49 $', { dailyCapCents: 49, incrementCents: 1 }, { dailyCapCents: 'PRICING_DAILY_CAP_INVALID' }],
    ['a negative cap', { dailyCapCents: -1800 }, { dailyCapCents: 'PRICING_DAILY_CAP_INVALID' }],
    ['a hold quota of 51', { holdQuota: 51 }, { holdQuota: 'PRICING_HOLD_QUOTA_INVALID' }],
    ['a negative hold quota', { holdQuota: -1 }, { holdQuota: 'PRICING_HOLD_QUOTA_INVALID' }],
  ])('refuses %s on its own field', (_case, change: Partial<LotPricingRequest>, expected) => {
    expect(pricingErrors({ ...royPricing, ...change })).toEqual(expected);
  });

  it.each([
    ['the smallest cap Stripe charges, 0,50 $', { incrementCents: 1, dailyCapCents: 50 }],
    ['the largest amounts, 100 000,00 $', { incrementCents: 10_000_000, dailyCapCents: 10_000_000 }],
    ['a cap equal to one increment', { incrementCents: 1800, dailyCapCents: 1800 }],
    ['5- and 60-minute increments', { incrementMinutes: 5 }],
    ['a 60-minute increment', { incrementMinutes: 60 }],
    ['a hold quota of 0', { holdQuota: 0 }],
    ['a hold quota of 50', { holdQuota: 50 }],
  ])('accepts %s', (_case, change: Partial<LotPricingRequest>) => {
    expect(pricingErrors({ ...royPricing, ...change })).toEqual({});
  });

  it.each([10_000_001, 1e300, Number.NaN, Number.POSITIVE_INFINITY])('refuses an amount of %s cents', (cents) => {
    expect(pricingErrors({ ...royPricing, incrementCents: cents, dailyCapCents: cents })).toMatchObject({ incrementCents: 'PRICING_INCREMENT_CENTS_INVALID', dailyCapCents: 'PRICING_DAILY_CAP_INVALID' });
  });

  it('names every wrong field, the first one of the form first', () => {
    const errors = pricingErrors({ incrementCents: 0, incrementMinutes: 61, dailyCapCents: null, holdQuota: 51 });

    expect(Object.keys(errors)).toEqual(['incrementCents', 'incrementMinutes', 'dailyCapCents', 'holdQuota']);
    expect(firstFieldError(errors)).toBe('PRICING_INCREMENT_CENTS_INVALID');
  });
});

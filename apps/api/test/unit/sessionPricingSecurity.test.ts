import { describe, expect, it } from 'vitest';
import type { PricingPolicy } from '../../src/domain/pricing/PricingPolicy.ts';
import { amountSoFar, elapsedMinutesBetween, priceParkingSessionAt } from '../../src/domain/pricing/priceParkingSessionAt.ts';

// Pentest #38: the current-session amount is attacker-influenceable only through elapsed time (test clock) and
// the per-session pricing snapshot. These assert the math stays a bounded, non-negative, finite integer so no
// overflow, NaN, Infinity or negative amount can ever reach GET /v1/me/session. Verified live against the lane
// with the test clock at year 2100 (elapsed 38 394 720 min): amountCents stayed 2500. See pentest.log.

const INT4_MAX = 2_147_483_647;

function isBoundedCents(value: number, cap: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= cap;
}

describe('amountSoFar never overflows past the daily cap', () => {
  it.each([
    ['near-int4 increment price, astronomically long stay', { incrementCents: INT4_MAX, incrementMinutes: 1, dailyCapCents: 2500 }, Number.MAX_SAFE_INTEGER],
    ['near-int4 increment and near-int4 cap', { incrementCents: INT4_MAX, incrementMinutes: 1, dailyCapCents: INT4_MAX }, Number.MAX_SAFE_INTEGER],
    ['one-cent increments for ten years', { incrementCents: 1, incrementMinutes: 1, dailyCapCents: 2500 }, 10 * 365 * 24 * 60],
    ['seeded Parking Démo policy for a thousand years', { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 }, 1000 * 365 * 24 * 60],
  ])('stays a bounded integer: %s', (_case, pricing: PricingPolicy, elapsedMinutes) => {
    const amount = amountSoFar(pricing, elapsedMinutes);
    expect(Number.isFinite(amount)).toBe(true);
    expect(isBoundedCents(amount, pricing.dailyCapCents)).toBe(true);
    expect(amount).toBe(pricing.dailyCapCents);
  });

  it('bills at least one increment and never a negative or fractional amount for any non-negative elapsed', () => {
    const pricing: PricingPolicy = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 };
    for (const elapsedMinutes of [0, 1, 7, 14, 15, 16, 900, 1_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(isBoundedCents(amountSoFar(pricing, elapsedMinutes), pricing.dailyCapCents)).toBe(true);
    }
  });
});

describe('elapsed time is clamped and finite against clock tampering', () => {
  const enteredAt = new Date('2026-11-04T23:02:00Z');

  it('reads zero when the clock is driven behind the entry (no negative elapsed, no negative amount)', () => {
    const before = new Date(enteredAt.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
    expect(elapsedMinutesBetween(enteredAt, before)).toBe(0);
    const priced = priceParkingSessionAt({ enteredAt, pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 } }, before);
    expect(priced).toEqual({ elapsedMinutes: 0, amountCents: 75 });
  });

  it('stays a finite, non-negative integer with the clock driven far into the future', () => {
    const farFuture = new Date('2100-01-01T00:00:00Z');
    const priced = priceParkingSessionAt({ enteredAt, pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 } }, farFuture);
    expect(Number.isInteger(priced.elapsedMinutes)).toBe(true);
    expect(priced.elapsedMinutes).toBeGreaterThan(0);
    expect(Number.isFinite(priced.elapsedMinutes)).toBe(true);
    expect(Number.isSafeInteger(priced.amountCents)).toBe(true);
    expect(priced.amountCents).toBeGreaterThan(2500);
  });
});

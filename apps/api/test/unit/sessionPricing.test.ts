import { describe, expect, it } from 'vitest';
import { parsePricingPolicy, PricingPolicyInvalidError, type PricingPolicy } from '../../src/domain/pricing/PricingPolicy.ts';
import { amountSoFar, priceParkingSessionAt, stayAmount, stayLines } from '../../src/domain/pricing/priceParkingSessionAt.ts';

const parkingDemoPricing: PricingPolicy = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 };
const enteredAt = new Date(2026, 10, 4, 18, 2);

function minutesAfterEntry(minutes: number, seconds = 0): Date {
  return new Date(enteredAt.getTime() + (minutes * 60 + seconds) * 1000);
}

describe('priceParkingSessionAt', () => {
  it.each([
    { elapsed: '14:59', now: minutesAfterEntry(14, 59), elapsedMinutes: 14, amountCents: 75 },
    { elapsed: '15:00', now: minutesAfterEntry(15), elapsedMinutes: 15, amountCents: 75 },
    { elapsed: '15:01', now: minutesAfterEntry(15, 1), elapsedMinutes: 15, amountCents: 75 },
    { elapsed: '16:00', now: minutesAfterEntry(16), elapsedMinutes: 16, amountCents: 150 },
    { elapsed: '3 h 15', now: minutesAfterEntry(195), elapsedMinutes: 195, amountCents: 975 },
    { elapsed: '3 h 16', now: minutesAfterEntry(196), elapsedMinutes: 196, amountCents: 1050 },
    { elapsed: '10 h', now: minutesAfterEntry(600), elapsedMinutes: 600, amountCents: 2500 },
  ])('after $elapsed bills $elapsedMinutes minutes for $amountCents cents', ({ now, elapsedMinutes, amountCents }) => {
    expect(priceParkingSessionAt({ enteredAt, pricing: parkingDemoPricing }, now)).toEqual({ elapsedMinutes, amountCents });
  });

  it('bills one increment and no minutes when the clock reads before the entry', () => {
    expect(priceParkingSessionAt({ enteredAt, pricing: parkingDemoPricing }, minutesAfterEntry(-5))).toEqual({ elapsedMinutes: 0, amountCents: 75 });
  });
});

describe('amountSoFar', () => {
  it('bills 33 started increments in full, 2 475 cents', () => {
    expect(amountSoFar(parkingDemoPricing, 33 * 15)).toBe(2475);
  });

  it('stops at the daily cap from the 34th increment', () => {
    expect(amountSoFar(parkingDemoPricing, 33 * 15 + 1)).toBe(2500);
  });
});

describe('stays over 24 hours', () => {
  it('stays at the daily cap for exactly 24 hours, with no lines', () => {
    expect(stayAmount(parkingDemoPricing, 24 * 60)).toBe(2500);
    expect(stayLines(parkingDemoPricing, 24 * 60)).toEqual([]);
  });

  it('bills 30 hours as the first day at the cap and 6 hours at 3 $ an hour', () => {
    expect(stayLines(parkingDemoPricing, 30 * 60)).toEqual([
      { kind: 'DAY', dayNumber: 1, cents: 2500 },
      { kind: 'EXTRA', minutes: 360, cents: 1800 },
    ]);
    expect(stayAmount(parkingDemoPricing, 30 * 60)).toBe(4300);
  });

  it('bills 50 hours as two days and 2 hours, 56 $', () => {
    expect(stayLines(parkingDemoPricing, 50 * 60)).toEqual([
      { kind: 'DAY', dayNumber: 1, cents: 2500 },
      { kind: 'DAY', dayNumber: 2, cents: 2500 },
      { kind: 'EXTRA', minutes: 120, cents: 600 },
    ]);
    expect(stayAmount(parkingDemoPricing, 50 * 60)).toBe(5600);
  });

  it('bills exactly 48 hours as two days with no extra line', () => {
    expect(stayLines(parkingDemoPricing, 48 * 60)).toHaveLength(2);
    expect(stayAmount(parkingDemoPricing, 48 * 60)).toBe(5000);
  });

  it('starts the extra increment one minute past the day and caps the extra at a day', () => {
    expect(stayAmount(parkingDemoPricing, 24 * 60 + 1)).toBe(2575);
    expect(stayAmount(parkingDemoPricing, 47 * 60 + 59)).toBe(5000);
  });

  it('prices the live session beyond 24 hours with the running total', () => {
    expect(priceParkingSessionAt({ enteredAt, pricing: parkingDemoPricing }, minutesAfterEntry(30 * 60))).toEqual({ elapsedMinutes: 1800, amountCents: 4300 });
  });
});

describe('parsePricingPolicy', () => {
  it('reads the seeded Parking Démo policy with the lot cap', () => {
    expect(parsePricingPolicy({ incrementCents: 75, incrementMinutes: 15, holdQuota: 3 }, 2500)).toEqual(parkingDemoPricing);
  });

  it.each([
    ['a missing policy', null, 2500],
    ['a policy that is not an object', '75/15', 2500],
    ['a missing increment price', { incrementMinutes: 15 }, 2500],
    ['an increment price given as text', { incrementCents: '75', incrementMinutes: 15 }, 2500],
    ['a fractional increment length', { incrementCents: 75, incrementMinutes: 7.5 }, 2500],
    ['a zero increment length', { incrementCents: 75, incrementMinutes: 0 }, 2500],
    ['a negative increment price', { incrementCents: -75, incrementMinutes: 15 }, 2500],
    ['a zero daily cap', { incrementCents: 75, incrementMinutes: 15 }, 0],
    ['a lot without a daily cap', { incrementCents: 75, incrementMinutes: 15 }, null],
  ])('refuses %s', (_case, storedPolicy, dailyCapCents) => {
    expect(() => parsePricingPolicy(storedPolicy, dailyCapCents)).toThrow(PricingPolicyInvalidError);
  });
});

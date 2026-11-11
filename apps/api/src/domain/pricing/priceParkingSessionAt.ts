import type { ReceiptLine } from '@palier/shared-types';
import { MILLISECONDS_PER_MINUTE } from '../time/durations.ts';
import type { PricingPolicy } from './PricingPolicy.ts';

export interface PricedSession {
  readonly enteredAt: Date;
  readonly pricing: PricingPolicy;
}

export interface SessionPrice {
  readonly elapsedMinutes: number;
  readonly amountCents: number;
}

export function priceParkingSessionAt(session: PricedSession, now: Date): SessionPrice {
  const elapsedMinutes = elapsedMinutesBetween(session.enteredAt, now);
  return { elapsedMinutes, amountCents: stayAmount(session.pricing, elapsedMinutes) };
}

// Only whole minutes count, and a clock behind the entry reads as no time at all.
export function elapsedMinutesBetween(enteredAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / MILLISECONDS_PER_MINUTE));
}

const MINUTES_PER_DAY = 24 * 60;

// A stay of 24 h or less is one capped block and has no lines; beyond, each full 24 h costs the daily cap (Q39) and the minutes
// after the last full day are priced by started increments, capped like a day.
export function stayLines(pricing: PricingPolicy, elapsedMinutes: number): ReceiptLine[] {
  if (elapsedMinutes <= MINUTES_PER_DAY) {
    return [];
  }
  const fullDays = Math.floor(elapsedMinutes / MINUTES_PER_DAY);
  const lines: ReceiptLine[] = Array.from({ length: fullDays }, (_, index): ReceiptLine => ({ kind: 'DAY', dayNumber: index + 1, cents: pricing.dailyCapCents }));
  const extraMinutes = elapsedMinutes - fullDays * MINUTES_PER_DAY;
  return extraMinutes === 0 ? lines : [...lines, { kind: 'EXTRA', minutes: extraMinutes, cents: amountSoFar(pricing, extraMinutes) }];
}

// The first increment starts at entry, so even minute zero costs one increment. Beyond 24 h the days and the rest add up.
export function stayAmount(pricing: PricingPolicy, elapsedMinutes: number): number {
  const lines = stayLines(pricing, elapsedMinutes);
  return lines.length === 0 ? amountSoFar(pricing, elapsedMinutes) : lines.reduce((total, line) => total + line.cents, 0);
}

// One block of at most a day: the started increments, held at the daily cap.
export function amountSoFar(pricing: PricingPolicy, elapsedMinutes: number): number {
  const startedIncrements = Math.max(1, Math.ceil(elapsedMinutes / pricing.incrementMinutes));
  return Math.min(pricing.dailyCapCents, startedIncrements * pricing.incrementCents);
}

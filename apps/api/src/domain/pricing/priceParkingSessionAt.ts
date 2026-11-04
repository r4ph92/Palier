import type { PricingPolicy } from './PricingPolicy.ts';

const MILLISECONDS_PER_MINUTE = 60_000;

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
  return { elapsedMinutes, amountCents: amountSoFar(session.pricing, elapsedMinutes) };
}

// Only whole minutes count, and a clock behind the entry reads as no time at all.
export function elapsedMinutesBetween(enteredAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / MILLISECONDS_PER_MINUTE));
}

// The first increment starts at entry, so even minute zero costs one increment. Stays over 24 h belong to #51.
export function amountSoFar(pricing: PricingPolicy, elapsedMinutes: number): number {
  const startedIncrements = Math.max(1, Math.ceil(elapsedMinutes / pricing.incrementMinutes));
  return Math.min(pricing.dailyCapCents, startedIncrements * pricing.incrementCents);
}

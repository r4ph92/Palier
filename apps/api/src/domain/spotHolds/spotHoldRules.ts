import { MILLISECONDS_PER_MINUTE } from '../time/durations.ts';

// Q22: a short trip guarantee, one per driver, a few per lot so a handful of drivers cannot drain a lot.
export const SPOT_HOLD_DURATION_MINUTES = 15;
// Each lot sets its own quota with its pricing (decision 031); a lot starts with this one.
export const DEFAULT_SPOT_HOLD_QUOTA = 3;

export function spotHoldExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SPOT_HOLD_DURATION_MINUTES * MILLISECONDS_PER_MINUTE);
}

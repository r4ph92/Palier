// Q22: a short trip guarantee, one per driver, a few per lot so a handful of drivers cannot drain a lot.
export const SPOT_HOLD_DURATION_MINUTES = 15;
export const SPOT_HOLD_QUOTA_PER_LOT = 3;

const MILLISECONDS_PER_MINUTE = 60_000;

export function spotHoldExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SPOT_HOLD_DURATION_MINUTES * MILLISECONDS_PER_MINUTE);
}

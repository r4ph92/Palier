export type SpotCheckRefusalReason = 'SPOT_STILL_ASSIGNED' | 'SPOT_NOT_FREE';

export const SPOT_CHECK_MESSAGES: Readonly<Record<SpotCheckRefusalReason, string>> = {
  SPOT_STILL_ASSIGNED: 'Spot still assigned to a session; wait for the exit.',
  SPOT_NOT_FREE: 'Spot not free and held by no session; it stays flagged until it is free.',
};

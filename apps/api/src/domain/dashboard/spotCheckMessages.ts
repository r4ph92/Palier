export type SpotCheckRefusalReason = 'SPOT_STILL_ASSIGNED';

export const SPOT_CHECK_MESSAGES: Readonly<Record<SpotCheckRefusalReason, string>> = {
  SPOT_STILL_ASSIGNED: 'Spot still assigned to a session; wait for the exit.',
};

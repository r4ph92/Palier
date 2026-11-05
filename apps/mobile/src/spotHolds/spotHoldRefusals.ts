import type { SpotHoldRefusalCode } from '@palier/shared-types';

// Refusals with a message of their own; any unknown code reads as "Palier is not responding".
export const SPOT_HOLD_REFUSALS = [
  'PREREQUISITES_MISSING',
  'HOLD_ALREADY_EXISTS',
  'HOLD_QUOTA_REACHED',
  'NO_SUITABLE_SPOT',
  'LOT_NOT_FOUND',
  'LOT_NOT_IN_SERVICE',
  'HOLD_UNAVAILABLE',
  'TOO_MANY_HOLD_ATTEMPTS',
] as const satisfies readonly SpotHoldRefusalCode[];

export type SpotHoldRefusal = (typeof SPOT_HOLD_REFUSALS)[number];

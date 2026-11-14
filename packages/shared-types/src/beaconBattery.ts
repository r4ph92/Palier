import type { DashboardErrorCode } from './dashboard.ts';
import { fieldErrorsOf, isWholeNumberWithin, type FieldErrors } from './fieldErrors.ts';

export const BATTERY_PERCENT_LIMITS = { minimum: 0, maximum: 100 } as const;

// At or below this percent a battery is low (decision 036).
export const LOW_BATTERY_PERCENT = 20;

// A reading older than this says nothing about the battery today: the battery reads as unknown (decision 036).
export const BATTERY_READING_LIFETIME_DAYS = 90;

export type BatteryStatus = 'OK' | 'LOW' | 'UNKNOWN';

export interface BeaconBatteryReading {
  readonly percent: number;
}

export type BeaconBatteryField = 'percent';

export type BeaconBatteryErrorCode = Extract<DashboardErrorCode, 'BATTERY_PERCENT_INVALID'>;

export type BeaconBatteryErrors = FieldErrors<BeaconBatteryField, BeaconBatteryErrorCode>;

// The one rule for a battery reading, applied by the dashboard before sending and by the API before writing.
export function beaconBatteryErrors({ percent }: BeaconBatteryReading): BeaconBatteryErrors {
  return fieldErrorsOf<BeaconBatteryField, BeaconBatteryErrorCode>([
    ['percent', isWholeNumberWithin(percent, BATTERY_PERCENT_LIMITS) ? null : 'BATTERY_PERCENT_INVALID'],
  ]);
}

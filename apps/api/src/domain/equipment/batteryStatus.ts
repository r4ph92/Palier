import type { BatteryStatus } from '@palier/shared-types';
import { BATTERY_READING_LIFETIME_DAYS, LOW_BATTERY_PERCENT } from '@palier/shared-types/beaconBattery';
import type { LastBatteryReading } from './batteryReadings.ts';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const BATTERY_READING_LIFETIME_MILLISECONDS = BATTERY_READING_LIFETIME_DAYS * MILLISECONDS_PER_DAY;

// A reading older than its lifetime says nothing about the battery today, so it reads as no reading at all.
export function batteryStatusOf({ percent, reportedAt }: LastBatteryReading, now: Date): BatteryStatus {
  if (percent === null || reportedAt === null || now.getTime() - reportedAt.getTime() > BATTERY_READING_LIFETIME_MILLISECONDS) {
    return 'UNKNOWN';
  }
  return percent <= LOW_BATTERY_PERCENT ? 'LOW' : 'OK';
}

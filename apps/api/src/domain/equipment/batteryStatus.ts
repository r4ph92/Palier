import type { BatteryStatus } from '@palier/shared-types';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const LOW_BATTERY_PERCENT = 20;
export const BATTERY_READING_LIFETIME_MILLISECONDS = 90 * MILLISECONDS_PER_DAY;

export interface BatteryReading {
  readonly percent: number | null;
  readonly reportedAt: Date | null;
}

// A reading older than its lifetime says nothing about the battery today, so it reads as no reading at all.
export function batteryStatusOf({ percent, reportedAt }: BatteryReading, now: Date): BatteryStatus {
  if (percent === null || reportedAt === null || now.getTime() - reportedAt.getTime() > BATTERY_READING_LIFETIME_MILLISECONDS) {
    return 'UNKNOWN';
  }
  return percent <= LOW_BATTERY_PERCENT ? 'LOW' : 'OK';
}

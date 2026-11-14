import { sql, type SQL } from 'drizzle-orm';
import type { RecordedBatteryReading } from '../../domain/equipment/batteryReadings.ts';

// The one set clause for a reading, from the dashboard or a controller: percent and stamp change together (aisle_beacon_battery_reading_complete).
export function beaconBatteryAssignment({ percent, reportedAt }: RecordedBatteryReading): SQL {
  return sql`beacon_battery_percent = ${percent}, beacon_battery_reported_at = ${reportedAt.toISOString()}::timestamptz`;
}

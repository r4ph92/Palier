import { sql, type SQL } from 'drizzle-orm';
import type { BeaconBatteryReport, ReportingGate } from '../../domain/equipment/EquipmentReports.ts';

export function recordHeartbeatStatement(gate: ReportingGate, at: Date): SQL {
  return sql`update gate set last_heartbeat_at = ${at.toISOString()}::timestamptz where id = ${gate.id} and lot_id = ${gate.lotId}`;
}

// No row when the lot has no beacon with this minor.
export function recordReportedBatteryStatement({ lotId, beaconMinor, percent, reportedAt }: BeaconBatteryReport): SQL {
  return sql`
    update aisle set beacon_battery_percent = ${percent}, beacon_battery_reported_at = ${reportedAt.toISOString()}::timestamptz
    where lot_id = ${lotId} and beacon_minor = ${beaconMinor}
    returning id`;
}

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

// Entry gates first, then by name; a lot with no gate reads as one row of nulls. Never the QR secret or the endpoint.
export function readLotGatesStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select parking_lot.name as lot_name, gate.id as gate_id, gate.name as gate_name, gate.kind as gate_kind, gate.last_heartbeat_at
    from parking_lot
    left join gate on gate.lot_id = parking_lot.id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by gate.kind, gate.name`;
}

import { sql, type SQL } from 'drizzle-orm';
import type { BeaconBatteryReport, ReportingGate, TestPassage } from '../../domain/equipment/EquipmentReports.ts';
import { beaconBatteryAssignment } from './beaconBatteryAssignment.ts';

export function recordHeartbeatStatement(gate: ReportingGate, at: Date): SQL {
  return sql`update gate set last_heartbeat_at = ${at.toISOString()}::timestamptz where id = ${gate.id} and lot_id = ${gate.lotId}`;
}

// No row when the gate was not heard since heardSince or its key was revoked: checks and stamp are one statement.
// A key rotation clears last_heartbeat_at on the same row, so a test passage that waited on its row lock is refused.
export function recordTestPassageStatement(gate: ReportingGate, { at, heardSince, deviceKeyHash }: TestPassage): SQL {
  return sql`
    update gate set verified_at = ${at.toISOString()}::timestamptz
    where id = ${gate.id} and lot_id = ${gate.lotId} and last_heartbeat_at >= ${heardSince.toISOString()}::timestamptz
      and exists (select 1 from gate_device_key where gate_device_key.gate_id = gate.id and gate_device_key.key_hash = ${deviceKeyHash} and gate_device_key.revoked_at is null)
    returning id`;
}

// No row when the lot has no beacon with this minor.
export function recordReportedBatteryStatement({ lotId, beaconMinor, ...reading }: BeaconBatteryReport): SQL {
  return sql`
    update aisle set ${beaconBatteryAssignment(reading)}
    where lot_id = ${lotId} and beacon_minor = ${beaconMinor}
    returning id`;
}

// Passages without an arming time are left out; the window is on the closing time, and the instant comes from the app clock.
export function readGatePresenceStatement(operatorId: string, lotId: string, since: Date): SQL {
  return sql`
    select gate.id as gate_id, avg(extract(epoch from gate_passage.closed_at - gate_passage.armed_at))::float8 as average_seconds
    from gate
    join parking_lot on parking_lot.id = gate.lot_id
    join gate_passage on gate_passage.gate_id = gate.id
    where gate.lot_id = ${lotId} and parking_lot.operator_id = ${operatorId}
      and gate_passage.armed_at is not null and gate_passage.closed_at >= ${since.toISOString()}::timestamptz
    group by gate.id`;
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

import { sql, type SQL } from 'drizzle-orm';
import type { GateKind } from '@palier/shared-types';
import type { GateSettings } from '@palier/shared-types/gateDraft';
import type { GatePlace, NewGate } from '../../domain/dashboard/LotGateRepository.ts';
import { EXIT_ID_KIND_OF } from '../../domain/gates/AuthenticatedGate.ts';

export const GATE_NAME_UNIQUE = 'gate_lot_id_name_unique';

// Entry gates first, then by name; a lot with no gate reads as one row of nulls. Never a device key or the QR secret.
export function readGateSettingsStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select parking_lot.name as lot_name, gate.id as gate_id, gate.name as gate_name, gate.kind as gate_kind,
      gate.integration_kind, gate.endpoint, gate.has_loops, gate.exit_id_kind
    from parking_lot
    left join gate on gate.lot_id = parking_lot.id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}
    order by gate.kind, gate.name`;
}

// Run after the lot lock, so no other add can slip in between the count and the insert.
export function countLotGatesStatement(lotId: string): SQL {
  return sql`select count(*)::int as gate_count, (count(*) filter (where gate.kind = 'EXIT'))::int as exit_gate_count from gate where gate.lot_id = ${lotId}`;
}

export function insertGateStatement(lotId: string, { draft, qrSecret }: Omit<NewGate, 'deviceKeyHash'>): SQL {
  return sql`
    insert into gate (lot_id, name, kind, integration_kind, endpoint, has_loops, exit_id_kind, qr_secret)
    values (${lotId}, ${draft.name}, ${draft.kind}::gate_kind, ${draft.integrationKind}::gate_integration_kind, ${draft.endpoint},
      ${draft.reportsLoops}, ${EXIT_ID_KIND_OF[draft.exitIdentification]}::exit_id_kind, ${qrSecret})
    returning id`;
}

export function insertDeviceKeyStatement(gateId: string, deviceKeyHash: string): SQL {
  return sql`insert into gate_device_key (gate_id, key_hash) values (${gateId}, ${deviceKeyHash})`;
}

// The lot is already locked as the operator's: the gate only has to be in it.
export function readOwnedGateKindStatement({ lotId, gateId }: GatePlace): SQL {
  return sql`select gate.kind from gate where gate.id = ${gateId} and gate.lot_id = ${lotId}`;
}

// Only the QR link reads the secret, to sign it.
export function readOwnedGateQrSecretStatement({ lotId, gateId }: GatePlace): SQL {
  return sql`select gate.qr_secret from gate where gate.id = ${gateId} and gate.lot_id = ${lotId}`;
}

export function changeGateStatement({ lotId, gateId }: GatePlace, settings: GateSettings): SQL {
  return sql`
    update gate set name = ${settings.name}, integration_kind = ${settings.integrationKind}::gate_integration_kind, endpoint = ${settings.endpoint},
      has_loops = ${settings.reportsLoops}, exit_id_kind = ${EXIT_ID_KIND_OF[settings.exitIdentification]}::exit_id_kind
    where gate.id = ${gateId} and gate.lot_id = ${lotId}`;
}

export function revokeDeviceKeysStatement(gateId: string): SQL {
  return sql`update gate_device_key set revoked_at = now() where gate_device_key.gate_id = ${gateId} and gate_device_key.revoked_at is null`;
}

export function replaceQrSecretStatement({ lotId, gateId }: GatePlace, qrSecret: string): SQL {
  return sql`update gate set qr_secret = ${qrSecret} where gate.id = ${gateId} and gate.lot_id = ${lotId} returning gate.id`;
}

export interface OwnedGateKindRow extends Record<string, unknown> {
  readonly kind: GateKind;
}

export interface OwnedGateQrSecretRow extends Record<string, unknown> {
  readonly qr_secret: string | null;
}

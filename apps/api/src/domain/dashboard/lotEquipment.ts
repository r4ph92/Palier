import type { DashboardGateHealth, DashboardLotEquipment } from '@palier/shared-types';
import { gateHealthOf } from '../equipment/gateHealth.ts';
import type { Clock } from '../time/Clock.ts';
import type { LotEquipmentReader, StoredGate } from './LotEquipmentReader.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotEquipmentSources {
  readonly operators: MemberOperators;
  readonly equipment: LotEquipmentReader;
  readonly clock: Clock;
}

export async function readLotEquipmentOfMember({ operators, equipment, clock }: LotEquipmentSources, lot: MemberLot): Promise<DashboardLotEquipment> {
  const operatorId = await operatorIdOfMember(operators, lot.userId);
  const gates = ownedLotOrNotFound(await equipment.readLotGates(operatorId, lot.lotId));
  const now = clock();
  return { lotId: lot.lotId, lotName: gates.lotName, now: now.toISOString(), gates: gates.gates.map((gate) => gateHealthView(gate, now)) };
}

export function silentGateNamesOf(gates: readonly StoredGate[], now: Date): string[] {
  return gates.filter((gate) => gateHealthOf(gate.lastHeartbeatAt, now) === 'SILENT').map((gate) => gate.name);
}

function gateHealthView({ id, name, kind, lastHeartbeatAt }: StoredGate, now: Date): DashboardGateHealth {
  return { id, name, kind, health: gateHealthOf(lastHeartbeatAt, now), lastHeartbeatAt: lastHeartbeatAt?.toISOString() ?? null };
}

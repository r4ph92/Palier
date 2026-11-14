import type { DashboardGateHealth, DashboardLotEquipment } from '@palier/shared-types';
import { gateHealthOf } from '../equipment/gateHealth.ts';
import type { Clock } from '../time/Clock.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { LotEquipmentReader, LotGates, StoredGate } from './LotEquipmentReader.ts';
import { operatorIdOfMember, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotEquipmentSources {
  readonly operators: MemberOperators;
  readonly equipment: LotEquipmentReader;
  readonly clock: Clock;
}

export async function readLotEquipmentOfMember({ operators, equipment, clock }: LotEquipmentSources, lot: MemberLot): Promise<DashboardLotEquipment> {
  const gates = await readOwnedLotGates(equipment, await operatorIdOfMember(operators, lot.userId), lot.lotId);
  const now = clock();
  return { lotId: lot.lotId, lotName: gates.lotName, now: now.toISOString(), gates: gates.gates.map((gate) => gateHealthView(gate, now)) };
}

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
export async function readOwnedLotGates(equipment: LotEquipmentReader, operatorId: string, lotId: string): Promise<LotGates> {
  const gates = await equipment.readLotGates(operatorId, lotId);
  if (gates === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return gates;
}

export function silentGateNamesOf(gates: readonly StoredGate[], now: Date): string[] {
  return gates.filter((gate) => gateHealthOf(gate.lastHeartbeatAt, now) === 'SILENT').map((gate) => gate.name);
}

function gateHealthView({ id, name, kind, lastHeartbeatAt }: StoredGate, now: Date): DashboardGateHealth {
  return { id, name, kind, health: gateHealthOf(lastHeartbeatAt, now), lastHeartbeatAt: lastHeartbeatAt?.toISOString() ?? null };
}

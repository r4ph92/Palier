import type { DashboardGateHealth, DashboardLotEquipment } from '@palier/shared-types';
import { PRESENCE_WINDOW_DAYS } from '@palier/shared-types/gates';
import { gateHealthOf } from '../equipment/gateHealth.ts';
import type { Clock } from '../time/Clock.ts';
import { MILLISECONDS_PER_DAY } from '../time/durations.ts';
import type { LotEquipmentReader, StoredGate } from './LotEquipmentReader.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';

const PRESENCE_WINDOW_MILLISECONDS = PRESENCE_WINDOW_DAYS * MILLISECONDS_PER_DAY;

export interface LotEquipmentSources {
  readonly operators: MemberOperators;
  readonly equipment: LotEquipmentReader;
  readonly clock: Clock;
}

export async function readLotEquipmentOfMember({ operators, equipment, clock }: LotEquipmentSources, lot: MemberLot): Promise<DashboardLotEquipment> {
  const operatorId = await operatorIdOfMember(operators, lot);
  const gates = ownedLotOrNotFound(await equipment.readLotGates(operatorId, lot.lotId));
  const now = clock();
  const presence = await equipment.readGatePresence(operatorId, lot.lotId, new Date(now.getTime() - PRESENCE_WINDOW_MILLISECONDS));
  const gateViews = gates.gates.map((gate) => gateHealthView(gate, now, presence.get(gate.id) ?? null));
  return { lotId: lot.lotId, lotName: gates.lotName, now: now.toISOString(), gates: gateViews };
}

export function silentGateNamesOf(gates: readonly StoredGate[], now: Date): string[] {
  return gates.filter((gate) => gateHealthOf(gate.lastHeartbeatAt, now) === 'SILENT').map((gate) => gate.name);
}

function gateHealthView({ id, name, kind, lastHeartbeatAt }: StoredGate, now: Date, averagePresenceSeconds: number | null): DashboardGateHealth {
  const health = gateHealthOf(lastHeartbeatAt, now);
  return { id, name, kind, health, lastHeartbeatAt: lastHeartbeatAt?.toISOString() ?? null, averagePresenceSeconds };
}

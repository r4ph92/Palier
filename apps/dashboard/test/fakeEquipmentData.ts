import type { DashboardGateHealth, DashboardLotEquipment } from '@palier/shared-types';
import { garageRoy, parkingDemo } from './fakeDashboardData.ts';

// Local times, so "14 h 05" reads the same in every time zone the tests run in.
export const SERVER_NOW = new Date(2026, 10, 13, 14, 10);
export const LAST_HEARD = new Date(2026, 10, 13, 14, 5);

export const entreeDemo: DashboardGateHealth = {
  id: '00000000-0000-4000-8000-000000000701',
  name: 'Entrée Démo',
  kind: 'ENTRY',
  health: 'ONLINE',
  lastHeartbeatAt: new Date(2026, 10, 13, 14, 9, 40).toISOString(),
};
export const sortieDemo: DashboardGateHealth = { id: '00000000-0000-4000-8000-000000000702', name: 'Sortie Démo', kind: 'EXIT', health: 'NEVER_HEARD', lastHeartbeatAt: null };

export const gateNames: readonly string[] = [entreeDemo.name, sortieDemo.name];

export function equipmentOf(gates: readonly DashboardGateHealth[], now: Date = SERVER_NOW): DashboardLotEquipment {
  return { lotId: parkingDemo.id, lotName: parkingDemo.name, now: now.toISOString(), gates };
}

export function silent(gate: DashboardGateHealth, lastHeard: Date = LAST_HEARD): DashboardGateHealth {
  return { ...gate, health: 'SILENT', lastHeartbeatAt: lastHeard.toISOString() };
}

// Garage Roy has no gate yet, so Pierre sees the empty state.
export function seededEquipment(): Map<string, DashboardLotEquipment> {
  const garageRoyEquipment: DashboardLotEquipment = { lotId: garageRoy.id, lotName: garageRoy.name, now: SERVER_NOW.toISOString(), gates: [] };
  return new Map([[parkingDemo.id, equipmentOf([entreeDemo, sortieDemo])], [garageRoy.id, garageRoyEquipment]]);
}

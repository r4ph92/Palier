import type { DashboardGate } from '@palier/shared-types';
import { garageRoy, parkingDemo } from './fakeDashboardData.ts';
import { entreeDemo, sortieDemo } from './fakeEquipmentData.ts';

// The secret stays in the fake, as in the API: no gate answer ever holds it.
export interface FakeGate extends DashboardGate {
  qrSecret: string;
}

export const ENTREE_ROY_ID = '00000000-0000-4000-8000-000000000703';

const simulated = { integrationKind: 'SIMULATED', endpoint: null, reportsLoops: true, exitIdentification: 'NONE' } as const;

// Parking Démo has the seeded demo pair; Garage Roy one entry on a dry contact.
export function seededGates(): Map<string, FakeGate[]> {
  const parkingDemoGates: FakeGate[] = [
    { id: entreeDemo.id, name: entreeDemo.name, kind: 'ENTRY', ...simulated, qrSecret: 'secret-entree-demo' },
    { id: sortieDemo.id, name: sortieDemo.name, kind: 'EXIT', ...simulated, qrSecret: 'secret-sortie-demo' },
  ];
  const garageRoyGates: FakeGate[] = [{ id: ENTREE_ROY_ID, name: 'Entrée Roy', kind: 'ENTRY', ...simulated, integrationKind: 'DRY_CONTACT', qrSecret: 'secret-entree-roy' }];
  return new Map([[parkingDemo.id, parkingDemoGates], [garageRoy.id, garageRoyGates]]);
}

// The fake signs with the secret itself, so a test can tell which secret a printed link was made with.
export function qrLinkOf(gate: FakeGate): string {
  return `https://palier.app/q/palier1.${gate.id}.${gate.qrSecret}`;
}

import type { DashboardSpot } from '@palier/shared-types';
import { parkingDemoMap } from './fakeMapData.ts';
import { parkingDemo } from './fakeDashboardData.ts';

export interface FakeSpot extends DashboardSpot {
  readonly aisleId: string;
}

const PARKING_DEMO_AISLE_A = parkingDemoMap.levels[0]?.aisles[0]?.id ?? '';

function parkingDemoSpot(index: number, attributes: Partial<DashboardSpot>): FakeSpot {
  const spot = { id: `00000000-0000-4000-8000-00000000050${index}`, number: `A-${index}`, state: 'AVAILABLE', isEv: false, isAccessible: false, isOversize: false };
  return { ...spot, distanceToExit: 10 * index, ...attributes, aisleId: PARKING_DEMO_AISLE_A } as FakeSpot;
}

// Parking Démo's aisle A: one spot of each attribute, the third occupied. Garage Roy has none.
export function seededSpots(): Map<string, FakeSpot[]> {
  const parkingDemoSpots = [parkingDemoSpot(1, { isEv: true }), parkingDemoSpot(2, { isAccessible: true }), parkingDemoSpot(3, { isOversize: true, state: 'OCCUPIED' })];
  return new Map([[parkingDemo.id, parkingDemoSpots]]);
}

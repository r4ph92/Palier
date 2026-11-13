import type { DashboardLotMap } from '@palier/shared-types';
import { garageRoy, parkingDemo } from './fakeDashboardData.ts';

export const PLATFORM_UUID = '7B8098B8-9525-4406-AB73-4ABD2095EDC3';

// Parking Démo as seeded: P1 with aisles A and B drawn one above the other, and the exit lane.
export const parkingDemoMap: DashboardLotMap = {
  lotId: parkingDemo.id,
  lotName: parkingDemo.name,
  platformUuid: PLATFORM_UUID,
  beaconMajor: 1,
  levels: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      code: 'P1',
      displayOrder: 1,
      aisles: [
        { id: '00000000-0000-4000-8000-000000000401', code: 'A', beaconMinor: 1, isExitLane: false, rectangle: { x: 0, y: 0, width: 100, height: 40 } },
        { id: '00000000-0000-4000-8000-000000000402', code: 'B', beaconMinor: 2, isExitLane: false, rectangle: { x: 0, y: 50, width: 100, height: 40 } },
        { id: '00000000-0000-4000-8000-000000000403', code: 'Sortie', beaconMinor: 0, isExitLane: true, rectangle: null },
      ],
    },
  ],
};

// Garage Roy has no level yet, so Pierre starts from the empty map.
export function seededMaps(): Map<string, DashboardLotMap> {
  const garageRoyMap: DashboardLotMap = { lotId: garageRoy.id, lotName: garageRoy.name, platformUuid: PLATFORM_UUID, beaconMajor: 2, levels: [] };
  return new Map([[parkingDemo.id, parkingDemoMap], [garageRoy.id, garageRoyMap]]);
}

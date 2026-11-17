import type { LotExitShares } from '@palier/shared-types';
import { garageRoy, parkingDemo } from './fakeDashboardData.ts';

// Parking Démo as the story has it: 10 exits in 30 days, 5 by beacon, 3 by app tap, 2 by plate; Garage Roy has none.
export function seededExitShares(): Map<string, LotExitShares> {
  return new Map([
    [parkingDemo.id, { lotName: parkingDemo.name, totalExits: 10, counts: { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0, STAFF: 0 } }],
    [garageRoy.id, { lotName: garageRoy.name, totalExits: 0, counts: { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 0, STAFF: 0 } }],
  ]);
}

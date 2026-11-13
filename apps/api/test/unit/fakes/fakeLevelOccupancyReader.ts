import type { LevelOccupancy, LevelOccupancyReader } from '../../../src/domain/dashboard/LevelOccupancyReader.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';


// The story's Parking Démo: 3 occupied, 1 assigned with its entry confirmed, 1 held, 1 occupied-unknown, 1 out of service, 3 free, 7 vehicles counted.
export const parkingDemoOccupancy: LevelOccupancy = {
  lotName: 'Parking Démo',
  vehicleCount: 7,
  levels: [{ code: 'P1', counts: { AVAILABLE: 3, HELD: 1, ASSIGNED: 1, OCCUPIED: 3, OCCUPIED_UNKNOWN: 1, OUT_OF_SERVICE: 1 } }],
  confirmedAssignedCount: 1,
};

export const garageRoyOccupancy: LevelOccupancy = { lotName: 'Garage Roy', vehicleCount: 0, levels: [], confirmedAssignedCount: 0 };


// Answers only for a lot of the operator asking, like the SQL does.
export class FakeLevelOccupancyReader implements LevelOccupancyReader {
  readonly #lots: FakeLotStore;
  readonly #occupancies = new Map<string, LevelOccupancy>([
    [PARKING_DEMO_ID, parkingDemoOccupancy],
    [GARAGE_ROY_ID, garageRoyOccupancy],
  ]);

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  set(lotId: string, occupancy: LevelOccupancy): void {
    this.#occupancies.set(lotId, occupancy);
  }

  readLevelOccupancy(operatorId: string, lotId: string): Promise<LevelOccupancy | null> {
    const owned = this.#lots.indexOf(operatorId, lotId) >= 0;
    return Promise.resolve(owned ? (this.#occupancies.get(lotId) ?? null) : null);
  }
}

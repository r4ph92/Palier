import type { FreeSpot } from '../domain/allocation/chooseSpot.ts';
import { spotFits } from '../domain/allocation/chooseSpotFor.ts';
import { hasRoomForAnotherVehicle, type LotOccupancy } from '../domain/occupancy/hasRoomForAnotherVehicle.ts';
import type { VehicleNeeds } from '../domain/vehicles/VehicleRepository.ts';

export interface LotAdmissions {
  readonly occupancy: LotOccupancy;
  readonly freeSpots: readonly FreeSpot[];
  readonly needs: VehicleNeeds;
}

// Eligibility refuses the whole lot once its vehicles and held spots reach capacity; below that, the free spots that fit decide.
export function admissibleSpotCount({ occupancy, freeSpots, needs }: LotAdmissions): number {
  if (!hasRoomForAnotherVehicle(occupancy)) {
    return 0;
  }
  return freeSpots.filter((spot) => spotFits(needs, spot)).length;
}

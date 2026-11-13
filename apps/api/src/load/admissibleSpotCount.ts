import type { FreeSpot } from '../domain/allocation/chooseSpot.ts';
import { spotFits } from '../domain/allocation/chooseSpotFor.ts';
import { vehicleRoomLeft, type LotOccupancy } from '../domain/occupancy/hasRoomForAnotherVehicle.ts';
import type { VehicleNeeds } from '../domain/vehicles/VehicleRepository.ts';

export interface LotAdmissions {
  readonly occupancy: LotOccupancy;
  readonly freeSpots: readonly FreeSpot[];
  readonly needs: VehicleNeeds;
}

// The free count shown before the run: the room left by vehicles, held spots and admitted entries caps the free spots that fit (#110).
export function admissibleSpotCount({ occupancy, freeSpots, needs }: LotAdmissions): number {
  const fitting = freeSpots.filter((spot) => spotFits(needs, spot)).length;
  return Math.max(0, Math.min(vehicleRoomLeft(occupancy), fitting));
}

import { EntryRefusedError } from '../entries/EntryRefusedError.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import { chooseSpot, type FreeSpot } from './chooseSpot.ts';

type SpotGroup = (spot: FreeSpot) => boolean;

const accessible: SpotGroup = (spot) => spot.isAccessible;
const electric: SpotGroup = (spot) => spot.isEv;
const oversize: SpotGroup = (spot) => spot.isOversize;
const standard: SpotGroup = (spot) => !spot.isEv && !spot.isAccessible && !spot.isOversize;
// Oversize spots are kept for large vehicles while standard ones remain.
const oversizeOnly: SpotGroup = (spot) => spot.isOversize && !spot.isEv && !spot.isAccessible;

// The groups a vehicle may take, the right spot first. An oversize vehicle fits only an oversize spot,
// and electric or accessible spots are never given to a vehicle that does not need them.
function spotGroupsFor(needs: VehicleNeeds): readonly SpotGroup[] {
  if (needs.isOversize) {
    return [oversize];
  }
  return [...(needs.hasAccessiblePermit ? [accessible] : []), ...(needs.isElectric ? [electric] : []), standard, oversizeOnly];
}

// The need comes before the level: chooseSpot orders the spots inside the first group that has one free.
// Null when no spot is free; throws NO_SUITABLE_SPOT when spots are free but none fits the vehicle.
export function chooseSpotFor(needs: VehicleNeeds, freeSpots: readonly FreeSpot[]): FreeSpot | null {
  for (const group of spotGroupsFor(needs)) {
    const chosen = chooseSpot(freeSpots.filter(group));
    if (chosen !== null) {
      return chosen;
    }
  }
  if (freeSpots.length > 0) {
    throw new EntryRefusedError('NO_SUITABLE_SPOT');
  }
  return null;
}

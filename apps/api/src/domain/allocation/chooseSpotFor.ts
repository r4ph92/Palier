import { EntryRefusedError } from '../entries/EntryRefusedError.ts';
import { isInCategory } from '../spots/spotCategories.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import { chooseSpot, type FreeSpot } from './chooseSpot.ts';

type SpotGroup = (spot: FreeSpot) => boolean;

const accessible: SpotGroup = (spot) => isInCategory(spot, 'accessible');
const electric: SpotGroup = (spot) => isInCategory(spot, 'electric');
const oversize: SpotGroup = (spot) => isInCategory(spot, 'oversize');
const standard: SpotGroup = (spot) => isInCategory(spot, 'standard');

// Electric and accessible spots go only to a vehicle with that need, even when the spot has another flag too,
// and an oversize vehicle fits only an oversize spot. Exported for the load script, which counts the spots a vehicle fits.
export function spotFits(needs: VehicleNeeds, spot: FreeSpot): boolean {
  return (!spot.isEv || needs.isElectric) && (!spot.isAccessible || needs.hasAccessiblePermit) && (!needs.isOversize || spot.isOversize);
}

// The groups a vehicle tries, the right spot first. Oversize spots are kept for large vehicles while standard ones remain.
function spotGroupsFor(needs: VehicleNeeds): readonly SpotGroup[] {
  if (needs.isOversize) {
    return [oversize];
  }
  return [...(needs.hasAccessiblePermit ? [accessible] : []), ...(needs.isElectric ? [electric] : []), standard, oversize];
}

// The need comes before the level: chooseSpot orders the spots inside the first group that has one free.
// Null when no spot is free; throws NO_SUITABLE_SPOT when spots are free but none fits the vehicle.
export function chooseSpotFor(needs: VehicleNeeds, freeSpots: readonly FreeSpot[]): FreeSpot | null {
  const fitting = freeSpots.filter((spot) => spotFits(needs, spot));
  for (const group of spotGroupsFor(needs)) {
    const chosen = chooseSpot(fitting.filter(group));
    if (chosen !== null) {
      return chosen;
    }
  }
  if (freeSpots.length > 0) {
    throw new EntryRefusedError('NO_SUITABLE_SPOT');
  }
  return null;
}

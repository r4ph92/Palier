import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import type { FreeSpot } from './chooseSpot.ts';
import { chooseSpotFor, spotFits } from './chooseSpotFor.ts';

// A driver who finds their spot taken stays in its aisle when a fitting spot is free there, before the need groups of the
// whole lot (decision 022). Null when no free spot fits anywhere.
export function chooseReplacementSpot(needs: VehicleNeeds, freeSpots: readonly FreeSpot[], preferredAisleId: string): FreeSpot | null {
  const fitting = freeSpots.filter((spot) => spotFits(needs, spot));
  const inPreferredAisle = fitting.filter((spot) => spot.aisleId === preferredAisleId);
  return chooseSpotFor(needs, inPreferredAisle) ?? chooseSpotFor(needs, fitting);
}

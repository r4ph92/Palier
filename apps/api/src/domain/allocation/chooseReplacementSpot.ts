import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import type { FreeSpot } from './chooseSpot.ts';
import { chooseSpotFor, spotFits } from './chooseSpotFor.ts';

export interface ReportedSpot {
  readonly id: string;
  readonly aisleId: string;
}

// A driver who finds their spot taken stays in its aisle when a fitting spot is free there, before the need groups of the
// whole lot (decision 022). The reported spot itself is never handed back, even freed by an operator. Null when nothing fits.
export function chooseReplacementSpot(needs: VehicleNeeds, freeSpots: readonly FreeSpot[], reported: ReportedSpot): FreeSpot | null {
  const fitting = freeSpots.filter((spot) => spot.id !== reported.id && spotFits(needs, spot));
  const inReportedAisle = fitting.filter((spot) => spot.aisleId === reported.aisleId);
  return chooseSpotFor(needs, inReportedAisle) ?? chooseSpotFor(needs, fitting);
}

import type { SpotCountByCategory } from '@palier/shared-types';

// A spot flagged for two needs counts in both categories; a standard spot carries no flag.
export interface LotAvailability {
  readonly capacity: number;
  readonly vehicleCount: number;
  // Spots HELD by an active spot hold: no longer available, and not yet a vehicle inside.
  readonly heldSpotCount: number;
  // Spots ASSIGNED to an entry admitted but not yet through the loop: counted as a vehicle once the loop closes (#110).
  readonly assignedSpotCount: number;
  readonly availableSpotCount: number;
  readonly availableByCategory: SpotCountByCategory;
}

import type { SpotCountByCategory } from '@palier/shared-types';

// A spot flagged for two needs counts in both categories; a standard spot carries no flag.
export interface LotAvailability {
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly availableSpotCount: number;
  readonly availableByCategory: SpotCountByCategory;
}

import type { SpotCountByCategory } from '@palier/shared-types';
import { countByCategory } from '@palier/shared-types/lots';
import { freeSpotCount } from './freeSpotCount.ts';
import type { LotAvailability } from './LotAvailability.ts';

export function freeSpotsByCategory(availability: LotAvailability): SpotCountByCategory {
  const total = freeSpotCount(availability);
  return countByCategory((category) => Math.min(availability.availableByCategory[category], total));
}

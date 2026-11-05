import type { SpotCountByCategory } from '@palier/shared-types';
import { freeSpotCount } from './freeSpotCount.ts';
import type { LotAvailability } from './LotAvailability.ts';

export function freeSpotsByCategory(availability: LotAvailability): SpotCountByCategory {
  const total = freeSpotCount(availability);
  const { standard, electric, accessible, oversize } = availability.availableByCategory;
  const capped = (count: number): number => Math.min(count, total);
  return { standard: capped(standard), electric: capped(electric), accessible: capped(accessible), oversize: capped(oversize) };
}

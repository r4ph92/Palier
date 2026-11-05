import type { SpotCountByCategory } from '@palier/shared-types';
import { countByCategory } from '@palier/shared-types/lots';
import { isInCategory, type SpotFlags } from '../spots/spotCategories.ts';

// How many available spots of a lot carry one combination of flags.
export interface AvailableSpotGroup extends SpotFlags {
  readonly count: number;
}

export function availableByCategory(groups: readonly AvailableSpotGroup[]): SpotCountByCategory {
  return countByCategory((category) => availableSpotCount(groups.filter((group) => isInCategory(group, category))));
}

export function availableSpotCount(groups: readonly AvailableSpotGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

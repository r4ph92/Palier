import type { SpotCountByCategory } from '@palier/shared-types';
import { isInCategory, type SpotFlags } from '../spots/spotCategories.ts';

// How many available spots of a lot carry one combination of flags.
export interface AvailableSpotGroup extends SpotFlags {
  readonly count: number;
}

export function availableByCategory(groups: readonly AvailableSpotGroup[]): SpotCountByCategory {
  const countIn = (category: keyof SpotCountByCategory): number =>
    groups.filter((group) => isInCategory(group, category)).reduce((sum, group) => sum + group.count, 0);
  return { standard: countIn('standard'), electric: countIn('electric'), accessible: countIn('accessible'), oversize: countIn('oversize') };
}

export function availableSpotCount(groups: readonly AvailableSpotGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

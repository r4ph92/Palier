import type { DashboardAisleSpots } from '@palier/shared-types';

export function firstAddedSpotId(before: DashboardAisleSpots, after: DashboardAisleSpots): string | null {
  const knownIds = new Set(before.spots.map(({ id }) => id));
  return after.spots.find(({ id }) => !knownIds.has(id))?.id ?? null;
}

import type { LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { spokenDistance } from '../i18n/formatDistance';
import { i18n } from '../i18n/i18n';
import { LIST_SEPARATOR, NO_BREAK_SPACE } from '../i18n/spaces';
import type { NearbyLot } from './nearbyLots';

const SPOKEN_SEPARATOR = ', ';

export function categoryLine(counts: SpotCountByCategory): string {
  return categoryCounts(counts, NO_BREAK_SPACE)
    .map((categoryCount) => categoryCount.replaceAll(' ', NO_BREAK_SPACE))
    .join(LIST_SEPARATOR);
}

export function lotAccessibilityLabel({ lot, distanceMetres }: NearbyLot): string {
  const distance = distanceMetres === null ? [] : [spokenDistance(distanceMetres)];
  return [lot.name, ...distance, ...spokenAvailability(lot)].join(SPOKEN_SEPARATOR);
}

function spokenAvailability({ freeSpots, freeSpotsByCategory }: LotSummary): string[] {
  if (freeSpots === 0) {
    return [i18n.t('home.fullAccessibilityLabel')];
  }
  return [`${freeSpots} ${i18n.t('home.freeSpotsLabel', { count: freeSpots })}`, ...categoryCounts(freeSpotsByCategory, ' ')];
}

function categoryCounts(counts: SpotCountByCategory, space: string): string[] {
  return SPOT_CATEGORIES.map((category) => `${i18n.t(`home.categories.${category}`)}${space}${counts[category]}`);
}

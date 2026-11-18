import type { LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { spokenDistance } from '../i18n/formatDistance';
import { i18n } from '../i18n/i18n';
import { tariffSentence } from '../i18n/tariffText';
import { LIST_SEPARATOR, NO_BREAK_SPACE } from '../i18n/spaces';
import type { NearbyLot } from './nearbyLots';

const SPOKEN_SEPARATOR = ', ';

export function categoryLines(counts: SpotCountByCategory): string[] {
  return categoryCounts(counts, NO_BREAK_SPACE).map((categoryCount) => categoryCount.replaceAll(' ', NO_BREAK_SPACE));
}

export function categoryLine(counts: SpotCountByCategory): string {
  return categoryLines(counts).join(LIST_SEPARATOR);
}

export function lotAccessibilityLabel({ lot, distanceMetres }: NearbyLot): string {
  const distance = distanceMetres === null ? [] : [spokenDistance(distanceMetres)];
  const tariff = lot.tariff === null ? [] : [tariffSentence(lot.tariff)];
  return [lot.name, ...distance, ...spokenAvailability(lot), ...tariff].join(SPOKEN_SEPARATOR);
}

function spokenAvailability({ freeSpots, capacity, freeSpotsByCategory }: LotSummary): string[] {
  if (freeSpots === 0) {
    return [i18n.t('home.fullAccessibilityLabel')];
  }
  return [i18n.t('home.freeSpotsOutOf', { count: freeSpots, capacity }), ...categoryCounts(freeSpotsByCategory, ' ')];
}

function categoryCounts(counts: SpotCountByCategory, space: string): string[] {
  return SPOT_CATEGORIES.map((category) => `${i18n.t(`home.categories.${category}`)}${space}${counts[category]}`);
}

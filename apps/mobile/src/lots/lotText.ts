import type { LotSummary, SpotCountByCategory } from '@palier/shared-types';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { spokenDistance } from '../i18n/formatDistance';
import { i18n, type SupportedLanguage } from '../i18n/i18n';
import { NO_BREAK_SPACE } from '../i18n/spaces';
import type { NearbyLot } from './nearbyLots';

const CATEGORY_SEPARATOR = `${NO_BREAK_SPACE}· `;
const SPOKEN_SEPARATOR = ', ';

// « Standard 7 · Électrique 1 · Accessible 1 · Grand gabarit 1 »
export function categoryLine(counts: SpotCountByCategory): string {
  return categoryCounts(counts, NO_BREAK_SPACE)
    .map((categoryCount) => categoryCount.replaceAll(' ', NO_BREAK_SPACE))
    .join(CATEGORY_SEPARATOR);
}

// « Parking Démo, 350 mètres, 2 places libres, Standard 2, Électrique 1, Accessible 1, Grand gabarit 1 »
export function lotAccessibilityLabel({ lot, distanceMetres }: NearbyLot, language: SupportedLanguage): string {
  const distance = distanceMetres === null ? [] : [spokenDistance(distanceMetres, language)];
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

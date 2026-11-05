import { currentLanguage, i18n, type SupportedLanguage } from './i18n';
import { NO_BREAK_SPACE } from './spaces';

const METRES_PER_KILOMETRE = 1000;
const METRES_STEP = 10;
const KILOMETRE_TENTHS = 10;

type DistanceUnit = 'metres' | 'kilometres';

interface RoundedDistance {
  readonly amount: number;
  readonly unit: DistanceUnit;
}

const UNIT_SYMBOLS: Readonly<Record<DistanceUnit, string>> = { metres: 'm', kilometres: 'km' };

export function formatDistance(metres: number, language: SupportedLanguage): string {
  const { amount, unit } = roundedDistance(metres);
  return `${writtenAmount(amount, language)}${NO_BREAK_SPACE}${UNIT_SYMBOLS[unit]}`;
}

export function spokenDistance(metres: number): string {
  const { amount, unit } = roundedDistance(metres);
  return i18n.t(`home.distance.${unit}`, { count: amount, amount: writtenAmount(amount, currentLanguage()) });
}

function roundedDistance(metres: number): RoundedDistance {
  const roundedMetres = Math.round(metres / METRES_STEP) * METRES_STEP;
  if (roundedMetres < METRES_PER_KILOMETRE) {
    return { amount: roundedMetres, unit: 'metres' };
  }
  return { amount: Math.round((metres / METRES_PER_KILOMETRE) * KILOMETRE_TENTHS) / KILOMETRE_TENTHS, unit: 'kilometres' };
}

function writtenAmount(amount: number, language: SupportedLanguage): string {
  const written = String(amount);
  return language === 'fr' ? written.replace('.', ',') : written;
}

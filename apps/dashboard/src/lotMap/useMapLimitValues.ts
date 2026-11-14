import { AISLE_CODE_LENGTH } from '@palier/shared-types/aisleDraft';
import { AISLE_GRID_LIMIT } from '@palier/shared-types/aisleRectangle';
import { BATTERY_PERCENT_LIMITS } from '@palier/shared-types/beaconBattery';
import { AISLE_MINOR_LIMITS } from '@palier/shared-types/beacons';
import { LEVEL_CODE_LENGTH, MAX_LEVELS_PER_LOT } from '@palier/shared-types/levelDraft';
import { useMemo } from 'react';
import { formatCount } from '../i18n/formatNumbers.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';

function limitValuesIn(language: Language): Readonly<Record<string, string>> {
  return {
    levelCodeMaximum: formatCount(LEVEL_CODE_LENGTH.maximum, language),
    levelMaximum: formatCount(MAX_LEVELS_PER_LOT, language),
    aisleCodeMaximum: formatCount(AISLE_CODE_LENGTH.maximum, language),
    minorMinimum: formatCount(AISLE_MINOR_LIMITS.minimum, language),
    minorMaximum: formatCount(AISLE_MINOR_LIMITS.maximum, language),
    gridMaximum: formatCount(AISLE_GRID_LIMIT, language),
    percentMinimum: formatCount(BATTERY_PERCENT_LIMITS.minimum, language),
    percentMaximum: formatCount(BATTERY_PERCENT_LIMITS.maximum, language),
  };
}

// Fills the limits in the map's hints and errors, so the sentences follow the shared rules.
export function useMapLimitValues(): Readonly<Record<string, string>> {
  const { language } = useLanguage();
  return useMemo(() => limitValuesIn(language), [language]);
}

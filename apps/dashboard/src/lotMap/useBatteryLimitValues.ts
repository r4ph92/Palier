import { BATTERY_PERCENT_LIMITS, BATTERY_READING_LIFETIME_DAYS, LOW_BATTERY_PERCENT } from '@palier/shared-types/beaconBattery';
import { useMemo } from 'react';
import { formatCount, formatPercent } from '../i18n/formatNumbers.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';

function batteryValuesIn(language: Language): Readonly<Record<string, string>> {
  return {
    percentMinimum: formatCount(BATTERY_PERCENT_LIMITS.minimum, language),
    percentMaximum: formatCount(BATTERY_PERCENT_LIMITS.maximum, language),
    lowPercent: formatPercent(LOW_BATTERY_PERCENT, language),
    lifetimeDays: formatCount(BATTERY_READING_LIFETIME_DAYS, language),
  };
}

// Fills the battery limits in the beacon table's help and in the reading form's errors.
export function useBatteryLimitValues(): Readonly<Record<string, string>> {
  const { language } = useLanguage();
  return useMemo(() => batteryValuesIn(language), [language]);
}

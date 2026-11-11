import { formatMoney } from '@palier/shared-types/money';
import { LOT_ADDRESS_LENGTH, LOT_CAPACITY_LIMITS, LOT_NAME_LENGTH } from '@palier/shared-types/lotDraft';
import { DAILY_CAP_CENTS_LIMITS, HOLD_QUOTA_LIMITS, INCREMENT_CENTS_LIMITS, INCREMENT_MINUTES_LIMITS, PRICING_MAX_CENTS } from '@palier/shared-types/lotPricing';
import { useMemo } from 'react';
import { formatCount } from '../i18n/formatNumbers.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';

function limitValuesIn(language: Language): Readonly<Record<string, string>> {
  return {
    nameMaximum: formatCount(LOT_NAME_LENGTH.maximum, language),
    addressMaximum: formatCount(LOT_ADDRESS_LENGTH.maximum, language),
    capacityMaximum: formatCount(LOT_CAPACITY_LIMITS.maximum, language),
    minutesMinimum: formatCount(INCREMENT_MINUTES_LIMITS.minimum, language),
    minutesMaximum: formatCount(INCREMENT_MINUTES_LIMITS.maximum, language),
    quotaMaximum: formatCount(HOLD_QUOTA_LIMITS.maximum, language),
    amountMaximum: formatMoney(PRICING_MAX_CENTS, language),
    incrementMinimum: formatMoney(INCREMENT_CENTS_LIMITS.minimum, language),
    capMinimum: formatMoney(DAILY_CAP_CENTS_LIMITS.minimum, language),
  };
}

// Fills the limits in the lot setup hints and errors, so the sentences follow the shared rules.
export function useLimitValues(): Readonly<Record<string, string>> {
  const { language } = useLanguage();
  return useMemo(() => limitValuesIn(language), [language]);
}

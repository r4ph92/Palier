import type { LotPricing } from '@palier/shared-types';
import { DEFAULT_HOLD_QUOTA, pricingErrors, type LotPricingRequest, type PricingField } from '@palier/shared-types/lotPricing';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { amountInputOf } from './amountInput.ts';
import { numberOrNaN, parseAmount, parseWholeNumber, type ParsedNumber } from './parseNumbers.ts';

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, PricingField>>> = {
  PRICING_INCREMENT_CENTS_INVALID: 'incrementCents',
  PRICING_INCREMENT_MINUTES_INVALID: 'incrementMinutes',
  PRICING_DAILY_CAP_REQUIRED: 'dailyCapCents',
  PRICING_DAILY_CAP_INVALID: 'dailyCapCents',
  PRICING_DAILY_CAP_BELOW_INCREMENT: 'dailyCapCents',
  PRICING_HOLD_QUOTA_INVALID: 'holdQuota',
};

const NO_PRICING_YET: FieldValues<PricingField> = { incrementCents: '', incrementMinutes: '', dailyCapCents: '', holdQuota: String(DEFAULT_HOLD_QUOTA) };

function valuesOf(pricing: LotPricing | null, language: Language): FieldValues<PricingField> {
  if (pricing === null) {
    return NO_PRICING_YET;
  }
  return {
    incrementCents: amountInputOf(pricing.incrementCents, language),
    incrementMinutes: String(pricing.incrementMinutes),
    dailyCapCents: amountInputOf(pricing.dailyCapCents, language),
    holdQuota: String(pricing.holdQuota),
  };
}

// An empty cap is null, which the shared rule names as required; any other unreadable number is NaN, refused on its field.
function dailyCapOf(parsed: ParsedNumber): number | null {
  return !parsed.ok && parsed.reason === 'empty' ? null : numberOrNaN(parsed);
}

function readPricing(values: FieldValues<PricingField>): ReadForm<PricingField, LotPricingRequest> {
  const pricing: LotPricingRequest = {
    incrementCents: numberOrNaN(parseAmount(values.incrementCents)),
    incrementMinutes: numberOrNaN(parseWholeNumber(values.incrementMinutes)),
    dailyCapCents: dailyCapOf(parseAmount(values.dailyCapCents)),
    holdQuota: numberOrNaN(parseWholeNumber(values.holdQuota)),
  };
  return readFormOf(pricing, pricingErrors(pricing));
}

export interface PricingFormTarget {
  readonly lotId: string;
  readonly pricing: LotPricing | null;
  readonly onSaved: () => void;
}

export function usePricingForm({ lotId, pricing, onSaved }: PricingFormTarget): FieldForm<PricingField> {
  const { language } = useLanguage();
  const send = async (request: LotPricingRequest) => {
    await dashboardClient.setLotPricing(lotId, request);
    onSaved();
  };
  return useFieldForm({ initialValues: valuesOf(pricing, language), read: readPricing, send, fieldOfCode: FIELD_OF_CODE });
}

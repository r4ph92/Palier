import { DEFAULT_HOLD_QUOTA, pricingErrors, type LotPricingSettings, type LotPricingRequest, type PricingErrorCode, type PricingField } from '@palier/shared-types/lotPricing';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { amountInputOf } from './amountInput.ts';
import { numberOrNaN, parseAmount, parseWholeNumber, type ParsedNumber } from './parseNumbers.ts';

const FIELD_OF_CODE: Readonly<Record<PricingErrorCode, PricingField>> = {
  PRICING_INCREMENT_CENTS_INVALID: 'incrementCents',
  PRICING_INCREMENT_MINUTES_INVALID: 'incrementMinutes',
  PRICING_DAILY_CAP_REQUIRED: 'dailyCapCents',
  PRICING_DAILY_CAP_INVALID: 'dailyCapCents',
  PRICING_DAILY_CAP_BELOW_INCREMENT: 'dailyCapCents',
  PRICING_HOLD_QUOTA_INVALID: 'holdQuota',
};

const AMOUNT_FIELDS = ['incrementCents', 'dailyCapCents'] as const satisfies readonly PricingField[];

const NO_PRICING_YET: FieldValues<PricingField> = { incrementCents: '', incrementMinutes: '', dailyCapCents: '', holdQuota: String(DEFAULT_HOLD_QUOTA) };

function valuesOf(pricing: LotPricingSettings | null, language: Language): FieldValues<PricingField> {
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
  readonly pricing: LotPricingSettings | null;
  readonly onSaved: () => void;
}

export function usePricingForm({ lotId, pricing, onSaved }: PricingFormTarget): FieldForm<PricingField> {
  const { language } = useLanguage();
  const send = async (request: LotPricingRequest) => {
    await dashboardClient.setLotPricing(lotId, request);
    onSaved();
  };
  const form = useFieldForm({ initialValues: valuesOf(pricing, language), read: readPricing, send, fieldOfCode: FIELD_OF_CODE });
  useAmountsInLanguage(form, language);
  return form;
}

// Rewrites each readable amount with the decimal mark of the new language, during the render that sees the switch.
// A field that shows an error keeps its text, so the error still describes what is in the box.
function useAmountsInLanguage(form: FieldForm<PricingField>, language: Language): void {
  const [shownIn, setShownIn] = useState(language);
  if (shownIn === language) {
    return;
  }
  setShownIn(language);
  for (const field of AMOUNT_FIELDS) {
    const amount = parseAmount(form.values[field]);
    if (amount.ok && form.errors[field] === undefined) {
      form.setValue(field, amountInputOf(amount.value, language));
    }
  }
}

import type { DashboardAisleSpots } from '@palier/shared-types';
import { addSpotsErrors, parseSpotRange, spotCountOf, type AddSpotsRequest, type SpotRange } from '@palier/shared-types/spotDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { attributesOf, EMPTY_ATTRIBUTES, type SpotAttributeField } from './spotFormValues.ts';
import { afterRefusal, type SpotRefusalFollowUp } from './spotRefusal.ts';

export type AddSpotsField = 'range' | SpotAttributeField;

const EMPTY_SPOTS: FieldValues<AddSpotsField> = { range: '', ...EMPTY_ATTRIBUTES };

const UNREADABLE_RANGE: SpotRange = { prefix: '', first: '', last: '' };

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, AddSpotsField>>> = {
  SPOT_RANGE_INVALID: 'range',
  SPOT_NUMBER_TAKEN: 'range',
  SPOT_DISTANCE_INVALID: 'distanceToExit',
};

// Numbers that read as no range get their own error: a mistyped separator is never sent as one spot.
function readSpots(values: FieldValues<AddSpotsField>, language: Language): ReadForm<AddSpotsField, AddSpotsRequest> {
  const range = parseSpotRange(values.range);
  const request = { range: range ?? UNREADABLE_RANGE, attributes: attributesOf(values, language) };
  const errors = addSpotsErrors(request);
  return readFormOf(request, range === null ? { ...errors, range: 'SPOT_RANGE_UNREADABLE' } : errors);
}

export interface AddSpotsTarget {
  readonly lotId: string;
  readonly aisleId: string;
  readonly onAdded: (spots: DashboardAisleSpots, count: number) => void;
  readonly onRefused: SpotRefusalFollowUp;
}

export function useAddSpotsForm({ lotId, aisleId, onAdded, onRefused }: AddSpotsTarget): FieldForm<AddSpotsField> {
  const { language } = useLanguage();
  const send = (request: AddSpotsRequest) =>
    afterRefusal(async () => onAdded(await dashboardClient.addSpots(lotId, aisleId, request), spotCountOf(request.range)), onRefused);
  return useFieldForm({ initialValues: EMPTY_SPOTS, read: (values) => readSpots(values, language), send, fieldOfCode: FIELD_OF_CODE, emptiesOnSuccess: true });
}

import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { spotAttributesErrors, type SpotAttributes } from '@palier/shared-types/spotDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { attributesOf, attributeValuesOf, type SpotAttributeField } from './spotFormValues.ts';
import { afterRefusal, type SpotRefusalFollowUp } from './spotRefusal.ts';

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, SpotAttributeField>>> = { SPOT_DISTANCE_INVALID: 'distanceToExit' };

function readAttributes(values: FieldValues<SpotAttributeField>, language: Language): ReadForm<SpotAttributeField, SpotAttributes> {
  const attributes = attributesOf(values, language);
  return readFormOf(attributes, spotAttributesErrors(attributes));
}

export interface EditSpotTarget {
  readonly lotId: string;
  readonly spot: DashboardSpot;
  readonly onSaved: (spots: DashboardAisleSpots) => void;
  readonly onRefused: SpotRefusalFollowUp;
}

// Starts from the spot as the list shows it; the number is not editable.
export function useEditSpotForm({ lotId, spot, onSaved, onRefused }: EditSpotTarget): FieldForm<SpotAttributeField> {
  const { language } = useLanguage();
  const send = (attributes: SpotAttributes) => afterRefusal(async () => onSaved(await dashboardClient.changeSpot(lotId, spot.id, attributes)), onRefused);
  return useFieldForm({ initialValues: attributeValuesOf(spot), read: (values) => readAttributes(values, language), send, fieldOfCode: FIELD_OF_CODE });
}

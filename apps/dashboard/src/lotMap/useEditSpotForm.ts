import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { spotAttributesErrors, type SpotAttributes } from '@palier/shared-types/spotDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import type { RefusalFollowUps } from '../api/followUpRefusal.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { attributesOf, attributeValuesOf, type SpotAttributeField } from './spotFormValues.ts';

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, SpotAttributeField>>> = { SPOT_DISTANCE_INVALID: 'distanceToExit' };

function readAttributes(values: FieldValues<SpotAttributeField>, language: Language): ReadForm<SpotAttributeField, SpotAttributes> {
  const attributes = attributesOf(values, language);
  return readFormOf(attributes, spotAttributesErrors(attributes));
}

type StaleData = Omit<RefusalFollowUps, 'refreshSession'>;

export interface EditSpotTarget {
  readonly lotId: string;
  readonly spot: DashboardSpot;
  readonly onSaved: (spots: DashboardAisleSpots) => void;
  // The spot is gone: the list closes this form and says why, since the form goes with the spot.
  readonly onGone: () => void;
  readonly staleData: StaleData;
}

export function useEditSpotForm({ lotId, spot, onSaved, onGone, staleData }: EditSpotTarget): FieldForm<SpotAttributeField> {
  const { language } = useLanguage();
  const send = async (attributes: SpotAttributes) => onSaved(await dashboardClient.changeSpot(lotId, spot.id, attributes));
  const read = (values: FieldValues<SpotAttributeField>) => readAttributes(values, language);
  return useFieldForm({ initialValues: attributeValuesOf(spot), read, send, fieldOfCode: FIELD_OF_CODE, staleData: closedWhenGone(staleData, onGone) });
}

function closedWhenGone(staleData: StaleData, onGone: () => void): StaleData {
  const refreshOn = (code: DisplayedErrorCode) => {
    if (code === 'SPOT_NOT_FOUND') {
      onGone();
    }
    return staleData.refreshOn?.(code) ?? null;
  };
  return { ...staleData, refreshOn };
}

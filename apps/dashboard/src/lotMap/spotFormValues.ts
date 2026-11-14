import type { DashboardSpot } from '@palier/shared-types';
import type { SpotAttributes } from '@palier/shared-types/spotDraft';
import type { FieldValues } from '../forms/useFieldForm.ts';
import type { Dictionary } from '../i18n/fr.ts';
import type { Language } from '../i18n/LanguageContext.tsx';
import { numberOrNaN, parseWholeNumber } from '../lotSetup/parseNumbers.ts';

export const SPOT_FLAGS = ['isEv', 'isAccessible', 'isOversize'] as const;

export type SpotFlag = (typeof SPOT_FLAGS)[number];

export type SpotAttributeField = SpotFlag | 'distanceToExit';

// A form keeps every value as text: a ticked box is CHECKED, an unticked one is empty.
export const CHECKED = 'checked';

export const EMPTY_ATTRIBUTES: FieldValues<SpotAttributeField> = { isEv: '', isAccessible: '', isOversize: '', distanceToExit: '' };

// Whole metres only: a decimal or unreadable distance becomes NaN, which the shared rule refuses on its own field.
export function attributesOf(values: FieldValues<SpotAttributeField>, language: Language): SpotAttributes {
  return {
    isEv: values.isEv === CHECKED,
    isAccessible: values.isAccessible === CHECKED,
    isOversize: values.isOversize === CHECKED,
    distanceToExit: numberOrNaN(parseWholeNumber(values.distanceToExit, language)),
  };
}

export function attributeValuesOf(spot: DashboardSpot): FieldValues<SpotAttributeField> {
  const flagValue = (flag: SpotFlag) => (spot[flag] ? CHECKED : '');
  return { isEv: flagValue('isEv'), isAccessible: flagValue('isAccessible'), isOversize: flagValue('isOversize'), distanceToExit: String(spot.distanceToExit) };
}

export function flagLabelsOf(spots: Dictionary['map']['spots']): Readonly<Record<SpotFlag, string>> {
  return { isEv: spots.electric, isAccessible: spots.accessible, isOversize: spots.oversize };
}

import type { AisleRectangle, DashboardLotMap } from '@palier/shared-types';
import { aisleDraftErrors, type AisleDraft, type AisleDraftErrors, type AisleDraftField } from '@palier/shared-types/aisleDraft';
import { AISLE_RECTANGLE_KEYS, isAisleRectangle, type AisleRectangleKey } from '@palier/shared-types/aisleRectangle';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, useFieldForm, type FieldErrorCodes, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { numberOrNaN, parseWholeNumber } from '../lotSetup/parseNumbers.ts';

const EMPTY_AISLE: FieldValues<AisleDraftField> = { code: '', beaconMinor: '', x: '', y: '', width: '', height: '' };

// A rectangle refused by the API, past the form's own rule, has no single field: it goes in the summary.
const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, AisleDraftField>>> = {
  AISLE_CODE_INVALID: 'code',
  AISLE_CODE_TAKEN: 'code',
  AISLE_CODE_RESERVED: 'code',
  AISLE_MINOR_INVALID: 'beaconMinor',
  AISLE_MINOR_TAKEN: 'beaconMinor',
};

// Whole grid units only: a decimal or unreadable number becomes NaN, which the shared rule refuses on its own field.
function rectangleOf(values: FieldValues<AisleDraftField>, language: Language): AisleRectangle {
  const side = (key: AisleRectangleKey) => numberOrNaN(parseWholeNumber(values[key], language));
  return { x: side('x'), y: side('y'), width: side('width'), height: side('height') };
}

function readAisle(values: FieldValues<AisleDraftField>, language: Language): ReadForm<AisleDraftField, AisleDraft> {
  const draft = { code: canonicalCodeOf(values.code), beaconMinor: numberOrNaN(parseWholeNumber(values.beaconMinor, language)), rectangle: rectangleOf(values, language) };
  return readFormOf(draft, shownErrorsOf(aisleDraftErrors(draft)));
}

// Each side of the rectangle says its own bounds beside it: x and y may be 0, a width or a height may not.
const RECTANGLE_SIDE_ERROR: Readonly<Record<AisleRectangleKey, DisplayedErrorCode>> = {
  x: 'GRID_POSITION_INVALID',
  y: 'GRID_POSITION_INVALID',
  width: 'GRID_LENGTH_INVALID',
  height: 'GRID_LENGTH_INVALID',
};

function shownErrorsOf(errors: AisleDraftErrors): FieldErrorCodes<AisleDraftField> {
  const shown: Partial<Record<AisleDraftField, DisplayedErrorCode>> = { ...errors };
  for (const side of AISLE_RECTANGLE_KEYS.filter((key) => errors[key] !== undefined)) {
    shown[side] = RECTANGLE_SIDE_ERROR[side];
  }
  return shown;
}

export interface DraftAisle {
  readonly rectangle: AisleRectangle;
  readonly label: string;
}

// The rectangle typed so far, once the rule accepts it: the plan draws only a rectangle that could be saved.
// It carries the code typed so far, or the generic label while the code is empty.
export function draftAisleOf(values: FieldValues<AisleDraftField>, language: Language, unnamedLabel: string): DraftAisle | null {
  const rectangle = rectangleOf(values, language);
  if (!isAisleRectangle(rectangle)) {
    return null;
  }
  const code = canonicalCodeOf(values.code);
  return { rectangle, label: code === '' ? unnamedLabel : code };
}

export interface AddAisleTarget {
  readonly lotId: string;
  readonly levelId: string;
  readonly onAdded: (map: DashboardLotMap, code: string) => void;
}

export function useAddAisleForm({ lotId, levelId, onAdded }: AddAisleTarget): FieldForm<AisleDraftField> {
  const { language } = useLanguage();
  const send = async (aisle: AisleDraft) => onAdded(await dashboardClient.addAisle(lotId, levelId, aisle), aisle.code);
  return useFieldForm({ initialValues: EMPTY_AISLE, read: (values) => readAisle(values, language), send, fieldOfCode: FIELD_OF_CODE, emptiesOnSuccess: true });
}

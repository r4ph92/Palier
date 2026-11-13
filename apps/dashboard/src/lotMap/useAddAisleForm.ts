import type { AisleRectangle, DashboardLotMap } from '@palier/shared-types';
import { aisleDraftErrors, type AisleDraft, type AisleDraftField } from '@palier/shared-types/aisleDraft';
import { isAisleRectangle, type AisleRectangleKey } from '@palier/shared-types/aisleRectangle';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useResettingFieldForm } from '../forms/useResettingFieldForm.ts';
import { numberOrNaN, parseWholeNumber } from '../lotSetup/parseNumbers.ts';

const EMPTY_AISLE: FieldValues<AisleDraftField> = { code: '', beaconMinor: '', x: '', y: '', width: '', height: '' };

// A rectangle refused by the API, past the form's own rule, has no single field: it goes in the summary.
const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, AisleDraftField>>> = {
  AISLE_CODE_INVALID: 'code',
  AISLE_CODE_TAKEN: 'code',
  AISLE_MINOR_INVALID: 'beaconMinor',
  AISLE_MINOR_TAKEN: 'beaconMinor',
};

// Whole grid units only: a decimal or unreadable number becomes NaN, which the shared rule refuses on its own field.
function rectangleOf(values: FieldValues<AisleDraftField>): AisleRectangle {
  const side = (key: AisleRectangleKey) => numberOrNaN(parseWholeNumber(values[key]));
  return { x: side('x'), y: side('y'), width: side('width'), height: side('height') };
}

function readAisle(values: FieldValues<AisleDraftField>): ReadForm<AisleDraftField, AisleDraft> {
  const draft = { code: values.code.trim(), beaconMinor: numberOrNaN(parseWholeNumber(values.beaconMinor)), rectangle: rectangleOf(values) };
  return readFormOf(draft, aisleDraftErrors(draft));
}

// The rectangle typed so far, once the rule accepts it: the plan draws only a rectangle that could be saved.
export function draftRectangleOf(values: FieldValues<AisleDraftField>): AisleRectangle | null {
  const rectangle = rectangleOf(values);
  return isAisleRectangle(rectangle) ? rectangle : null;
}

export interface AddAisleTarget {
  readonly lotId: string;
  readonly levelId: string;
  readonly onAdded: (map: DashboardLotMap, code: string) => void;
}

export function useAddAisleForm({ lotId, levelId, onAdded }: AddAisleTarget): FieldForm<AisleDraftField> {
  const send = async (aisle: AisleDraft) => onAdded(await dashboardClient.addAisle(lotId, levelId, aisle), aisle.code);
  return useResettingFieldForm({ initialValues: EMPTY_AISLE, read: readAisle, send, fieldOfCode: FIELD_OF_CODE });
}

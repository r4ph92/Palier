import type { DashboardErrorCode } from './dashboard.ts';
import { isValidDisplayText, type TextLength } from './displayText.ts';
import { fieldErrorsOf, isWholeNumberWithin, type FieldErrors } from './fieldErrors.ts';
import { isLatitude, isLongitude } from './lots.ts';

export const LOT_NAME_LENGTH = { minimum: 1, maximum: 120 } as const;
export const LOT_ADDRESS_LENGTH = { minimum: 1, maximum: 200 } as const;
export const LOT_CAPACITY_LIMITS = { minimum: 0, maximum: 10_000 } as const;

// What an operator gives to create a lot; the platform decides the rest (offline, no pricing, its beacon major).
export interface LotDraft {
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly capacity: number;
}

export type LotDraftField = keyof LotDraft;

export type LotDraftErrorCode = Extract<
  DashboardErrorCode,
  'LOT_NAME_REQUIRED' | 'LOT_NAME_INVALID' | 'LOT_ADDRESS_REQUIRED' | 'LOT_ADDRESS_INVALID' | 'LOT_LATITUDE_INVALID' | 'LOT_LONGITUDE_INVALID' | 'LOT_CAPACITY_INVALID'
>;

export type LotDraftErrors = FieldErrors<LotDraftField, LotDraftErrorCode>;

interface TextErrorCodes {
  readonly required: LotDraftErrorCode;
  readonly invalid: LotDraftErrorCode;
}

const NAME_CODES: TextErrorCodes = { required: 'LOT_NAME_REQUIRED', invalid: 'LOT_NAME_INVALID' };
const ADDRESS_CODES: TextErrorCodes = { required: 'LOT_ADDRESS_REQUIRED', invalid: 'LOT_ADDRESS_INVALID' };

// The one rule for a new lot, applied by the dashboard before sending and by the API before writing.
export function lotDraftErrors(draft: LotDraft): LotDraftErrors {
  return fieldErrorsOf<LotDraftField, LotDraftErrorCode>([
    ['name', textError(draft.name, LOT_NAME_LENGTH, NAME_CODES)],
    ['address', textError(draft.address, LOT_ADDRESS_LENGTH, ADDRESS_CODES)],
    ['latitude', isLatitude(draft.latitude) ? null : 'LOT_LATITUDE_INVALID'],
    ['longitude', isLongitude(draft.longitude) ? null : 'LOT_LONGITUDE_INVALID'],
    ['capacity', isWholeNumberWithin(draft.capacity, LOT_CAPACITY_LIMITS) ? null : 'LOT_CAPACITY_INVALID'],
  ]);
}

function textError(text: string, length: TextLength, codes: TextErrorCodes): LotDraftErrorCode | null {
  if (text.trim() === '') {
    return codes.required;
  }
  return isValidDisplayText(text, length) ? null : codes.invalid;
}

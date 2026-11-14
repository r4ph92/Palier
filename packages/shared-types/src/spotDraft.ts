import type { DashboardErrorCode } from './dashboard.ts';
import { fieldErrorsOf, isWholeNumberWithin, type FieldErrors } from './fieldErrors.ts';
import { SPOT_NUMBER_MAX_LENGTH } from './spotNumber.ts';

export const MAX_SPOTS_PER_ADD = 200;
export const MAX_SPOTS_PER_LOT = 10_000;
export const SPOT_DISTANCE_LIMITS = { minimum: 0, maximum: 2000 } as const;

// Six digits at most, so Number() reads them exactly; the first spot of a range is 1 or more.
const RANGE_DIGITS = /^\d{1,6}$/;
// What a painted sign shows: ASCII letters, digits, spaces and dashes, never a leading space. Empty is allowed: « 1 à 20 ».
const RANGE_PREFIX = /^(?:[A-Za-z0-9-][A-Za-z0-9 -]*)?$/;
const ENDS_WITH_DIGIT = /\d$/;
const RANGE_SEPARATOR = /\s+(?:à|to)\s+/iu;
const NUMBER_AND_DIGITS = /^(.*?)(\d+)$/su;

// Language-neutral: the dashboard reads « A-1 à A-20 » or « A-1 to A-20 » into { prefix: 'A-', first: '1', last: '20' }.
// first keeps its digits as typed, so « A-01 à A-20 » numbers the spots A-01 to A-20.
export interface SpotRange {
  readonly prefix: string;
  readonly first: string;
  readonly last: string;
}

export interface SpotAttributes {
  readonly isEv: boolean;
  readonly isAccessible: boolean;
  readonly isOversize: boolean;
  readonly distanceToExit: number;
}

export interface AddSpotsRequest {
  readonly range: SpotRange;
  readonly attributes: SpotAttributes;
}

export type SpotDraftField = 'range' | 'distanceToExit';

export type SpotDraftErrorCode = Extract<DashboardErrorCode, 'SPOT_RANGE_INVALID' | 'SPOT_DISTANCE_INVALID'>;

export type SpotDraftErrors = FieldErrors<SpotDraftField, SpotDraftErrorCode>;

// The one rule for spots added to an aisle, applied by the dashboard before sending and by the API before writing.
export function addSpotsErrors({ range, attributes }: AddSpotsRequest): SpotDraftErrors {
  return fieldErrorsOf<SpotDraftField, SpotDraftErrorCode>([
    ['range', isValidSpotRange(range) ? null : 'SPOT_RANGE_INVALID'],
    ...distanceCheckOf(attributes),
  ]);
}

// The rule for the attributes of one spot already in the aisle.
export function spotAttributesErrors(attributes: SpotAttributes): SpotDraftErrors {
  return fieldErrorsOf<SpotDraftField, SpotDraftErrorCode>(distanceCheckOf(attributes));
}

function distanceCheckOf({ distanceToExit }: SpotAttributes): (readonly ['distanceToExit', SpotDraftErrorCode | null])[] {
  return [['distanceToExit', isWholeNumberWithin(distanceToExit, SPOT_DISTANCE_LIMITS) ? null : 'SPOT_DISTANCE_INVALID']];
}

export function isValidSpotRange(range: SpotRange): boolean {
  return isValidPrefix(range.prefix) && RANGE_DIGITS.test(range.first) && RANGE_DIGITS.test(range.last) && hasValidBounds(range);
}

// A prefix ending in a digit would read as part of the number: « A1 » then « 5 » is A15, which the form never sends.
function isValidPrefix(prefix: string): boolean {
  return RANGE_PREFIX.test(prefix) && !ENDS_WITH_DIGIT.test(prefix);
}

function hasValidBounds(range: SpotRange): boolean {
  const count = spotCountOf(range);
  return Number(range.first) >= 1 && count >= 1 && count <= MAX_SPOTS_PER_ADD && spotNumberOf(range, Number(range.last)).length <= SPOT_NUMBER_MAX_LENGTH;
}

export function spotCountOf({ first, last }: SpotRange): number {
  return Number(last) - Number(first) + 1;
}

// Every number of a range the rule accepted, in order: each is padded to the width of the first.
export function spotNumbersOf(range: SpotRange): string[] {
  const first = Number(range.first);
  return Array.from({ length: spotCountOf(range) }, (_, index) => spotNumberOf(range, first + index));
}

function spotNumberOf({ prefix, first }: SpotRange, value: number): string {
  return `${prefix}${String(value).padStart(first.length, '0')}`;
}

// « A-1 à A-20 », « A-1 to A-20 » (either word in either language) or one number « A-7 »; null when it reads as neither.
// The prefixes must match exactly; the rule then checks the range itself.
export function parseSpotRange(text: string): SpotRange | null {
  const ends = text.normalize('NFC').trim().split(RANGE_SEPARATOR);
  if (ends.length > 2) {
    return null;
  }
  const start = numberAndDigitsOf(ends[0] ?? '');
  const end = numberAndDigitsOf(ends.at(-1) ?? '');
  if (start === null || end === null || start.prefix !== end.prefix) {
    return null;
  }
  return { prefix: start.prefix, first: start.digits, last: end.digits };
}

function numberAndDigitsOf(number: string): { readonly prefix: string; readonly digits: string } | null {
  const match = NUMBER_AND_DIGITS.exec(number);
  return match === null ? null : { prefix: match[1] ?? '', digits: match[2] ?? '' };
}

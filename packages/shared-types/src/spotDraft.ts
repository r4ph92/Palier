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
const HAS_LETTER_OR_DIGIT = /[A-Za-z0-9]/;
const HAS_LETTER = /[A-Za-z]/;
// « à », « a », « au » and « to », in either language: an operator types whichever comes first.
const RANGE_SEPARATOR = /\s+(?:à|au|a|to)\s+/giu;
const SEPARATOR_AFTER_DIGIT = /\d\s+(?:à|au|a|to)\s+/iu;
const NUMBER_AND_DIGITS = /^(.*?)(\d+)$/su;
// One number alone has the shape of a range end, but at most one dash and only before the digits, so « A-1-A-20 » is not one spot.
const SINGLE_NUMBER = /^([A-Za-z0-9 ]*?-?)(\d+)$/u;

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
// A prefix of dashes and spaces only reads as no prefix to a driver: « ---1 » is « 1 ».
function isValidPrefix(prefix: string): boolean {
  return RANGE_PREFIX.test(prefix) && !ENDS_WITH_DIGIT.test(prefix) && (prefix === '' || HAS_LETTER_OR_DIGIT.test(prefix));
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

// « A-1 à A-20 », « A-1 to A-20 » or one number « A-7 »; null when it reads as neither.
// A separator word after digits is a range attempt: « B 1 a 20 » with no valid split is never one spot.
// The prefixes must match exactly; the rule then checks the range itself.
export function parseSpotRange(text: string): SpotRange | null {
  const normalized = text.normalize('NFC').trim();
  const range = rangeAtAnySeparator(normalized);
  if (range !== null) {
    return range;
  }
  return SEPARATOR_AFTER_DIGIT.test(normalized) ? null : singleSpotOf(normalized);
}

// A separator word can sit inside a prefix (« Zone a 1 à Zone a 3 »): only a split where both sides read as range ends counts.
function rangeAtAnySeparator(text: string): SpotRange | null {
  for (const separator of text.matchAll(RANGE_SEPARATOR)) {
    const range = rangeOf(text.slice(0, separator.index), text.slice(separator.index + separator[0].length));
    if (range !== null) {
      return range;
    }
  }
  return null;
}

function rangeOf(startText: string, endText: string): SpotRange | null {
  const start = prefixAndDigitsOf(NUMBER_AND_DIGITS, startText);
  const end = prefixAndDigitsOf(NUMBER_AND_DIGITS, endText);
  if (start === null || end === null || start.prefix !== end.prefix) {
    return null;
  }
  return { prefix: start.prefix, first: start.digits, last: end.digits };
}

function singleSpotOf(text: string): SpotRange | null {
  const number = prefixAndDigitsOf(SINGLE_NUMBER, text);
  if (number === null || !HAS_LETTER.test(number.prefix)) {
    return null;
  }
  return { prefix: number.prefix, first: number.digits, last: number.digits };
}

function prefixAndDigitsOf(shape: RegExp, number: string): { readonly prefix: string; readonly digits: string } | null {
  const match = shape.exec(number);
  return match === null ? null : { prefix: match[1] ?? '', digits: match[2] ?? '' };
}

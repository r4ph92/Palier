import { AISLE_MINOR_LIMITS } from './beacons.ts';
import { AISLE_RECTANGLE_KEYS, isGridValue, type AisleRectangleKey } from './aisleRectangle.ts';
import type { DashboardErrorCode } from './dashboard.ts';
import { isValidDisplayText } from './displayText.ts';
import { fieldErrorsOf, isWholeNumberWithin, type FieldErrors } from './fieldErrors.ts';
import type { AisleRectangle } from './parkingSessions.ts';

export const AISLE_CODE_LENGTH = { minimum: 1, maximum: 10 } as const;

// An aisle drivers park in: its code, its beacon minor and its rectangle on the level's plan (decision 018).
export interface AisleDraft {
  readonly code: string;
  readonly beaconMinor: number;
  readonly rectangle: AisleRectangle;
}

// A request may leave the rectangle out: the rule then refuses it like a rectangle off the grid.
export interface AisleRequest extends Omit<AisleDraft, 'rectangle'> {
  readonly rectangle?: AisleRectangle | null;
}

export type AisleDraftField = 'code' | 'beaconMinor' | AisleRectangleKey;

export type AisleDraftErrorCode = Extract<DashboardErrorCode, 'AISLE_CODE_INVALID' | 'AISLE_MINOR_INVALID' | 'AISLE_RECTANGLE_INVALID'>;

export type AisleDraftErrors = FieldErrors<AisleDraftField, AisleDraftErrorCode>;

// Minor 0 is the exit lane's, which the platform creates itself; an aisle takes 1 to 65 535.
// The one rule for a new aisle, applied by the dashboard before sending and by the API before writing.
export function aisleDraftErrors({ code, beaconMinor, rectangle }: AisleDraft): AisleDraftErrors {
  return fieldErrorsOf<AisleDraftField, AisleDraftErrorCode>([
    ['code', isValidDisplayText(code, AISLE_CODE_LENGTH) ? null : 'AISLE_CODE_INVALID'],
    ['beaconMinor', isWholeNumberWithin(beaconMinor, AISLE_MINOR_LIMITS) ? null : 'AISLE_MINOR_INVALID'],
    ...AISLE_RECTANGLE_KEYS.map((key) => [key, isGridValue(key, rectangle[key]) ? null : 'AISLE_RECTANGLE_INVALID'] as const),
  ]);
}

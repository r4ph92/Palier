import type { DashboardErrorCode } from './dashboard.ts';
import { isValidDisplayText } from './displayText.ts';
import { fieldErrorsOf, type FieldErrors } from './fieldErrors.ts';

// "P1", "Niveau 2", "Toit": a code drivers read on a sign, short enough for the app's plan.
export const LEVEL_CODE_LENGTH = { minimum: 1, maximum: 10 } as const;
export const MAX_LEVELS_PER_LOT = 20;

export interface LevelDraft {
  readonly code: string;
}

export type LevelDraftField = keyof LevelDraft;

export type LevelDraftErrorCode = Extract<DashboardErrorCode, 'LEVEL_CODE_INVALID'>;

export type LevelDraftErrors = FieldErrors<LevelDraftField, LevelDraftErrorCode>;

// The one rule for a new level, applied by the dashboard before sending and by the API before writing.
export function levelDraftErrors(draft: LevelDraft): LevelDraftErrors {
  return fieldErrorsOf<LevelDraftField, LevelDraftErrorCode>([['code', isValidDisplayText(draft.code, LEVEL_CODE_LENGTH) ? null : 'LEVEL_CODE_INVALID']]);
}

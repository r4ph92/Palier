// Every mutating /v1/dashboard request carries this header; a cross-site form cannot set it.
export const DASHBOARD_CSRF_HEADER = 'x-requested-with';
export const DASHBOARD_CSRF_VALUE = 'palier-dashboard';

export const LEGAL_NAME_LENGTH = { minimum: 2, maximum: 120 } as const;

// Control, format and line-separator characters (NUL, zero-width spaces, bidi overrides, U+2028) are invisible, and Postgres refuses NUL in text.
const INVISIBLE_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

// Letters in Unicode that draw nothing: the Hangul fillers and the Braille blank.
const BLANK_LETTER = /[\u3164\u115F\u1160\uFFA0\u2800]/u;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Counted in code points after trimming, so an emoji is one character, the way a person counts it.
// A lone surrogate is refused because Postgres would store it as U+FFFD, a name nobody typed.
export function isValidLegalName(legalName: string): boolean {
  const trimmedName = legalName.trim();
  const length = [...trimmedName].length;
  return (
    length >= LEGAL_NAME_LENGTH.minimum &&
    length <= LEGAL_NAME_LENGTH.maximum &&
    trimmedName.isWellFormed() &&
    !INVISIBLE_CHARACTER.test(trimmedName) &&
    !BLANK_LETTER.test(trimmedName) &&
    LETTER_OR_DIGIT.test(trimmedName)
  );
}

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'ACTION_REQUIRED' | 'VERIFIED';

export interface DashboardUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface DashboardOperator {
  readonly id: string;
  readonly legalName: string;
  readonly kycStatus: KycStatus;
}

export interface DashboardMeResponse {
  readonly user: DashboardUser;
  readonly operator: DashboardOperator | null;
}

export interface CreateOperatorRequest {
  readonly legalName: string;
}

export interface DashboardLot {
  readonly id: string;
  readonly name: string;
  readonly isOnline: boolean;
}

export type DashboardLotListResponse = readonly DashboardLot[];

export type DashboardTestUserListResponse = readonly DashboardUser[];

export interface DashboardTestSignInRequest {
  readonly userId: string;
}

export interface DashboardSignInResponse {
  readonly user: DashboardUser;
}

// The one list of codes: the type derives from it, and the dashboard checks an answer's code against it.
export const DASHBOARD_ERROR_CODES = [
  'UNAUTHORIZED',
  'CSRF_HEADER_MISSING',
  'LEGAL_NAME_INVALID',
  'OPERATOR_EXISTS',
  'NO_OPERATOR',
  'LOT_NOT_FOUND',
] as const;

export type DashboardErrorCode = (typeof DASHBOARD_ERROR_CODES)[number];

export interface DashboardErrorBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
}

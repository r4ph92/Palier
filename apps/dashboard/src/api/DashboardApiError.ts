import type { DashboardErrorCode } from '@palier/shared-types';
import { DASHBOARD_ERROR_CODES } from '@palier/shared-types/dashboard';

function isDashboardErrorCode(code: string | undefined): code is DashboardErrorCode {
  return DASHBOARD_ERROR_CODES.some((known) => known === code);
}

// Never from the API: FIELDS_INVALID heads a form whose fields show their own errors; MAP_RELOAD_FAILED follows a stale move
// the page could not read again; GRID_POSITION_INVALID and GRID_LENGTH_INVALID sit beside one side of an aisle's rectangle;
// SPOT_RANGE_UNREADABLE sits beside numbers that read as no range.
export type DisplayedErrorCode =
  | DashboardErrorCode
  | 'FIELDS_INVALID'
  | 'MAP_RELOAD_FAILED'
  | 'GRID_POSITION_INVALID'
  | 'GRID_LENGTH_INVALID'
  | 'SPOT_RANGE_UNREADABLE'
  | 'UNKNOWN';

// The page shows a dictionary sentence for the code, never the API's English message.
export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: DisplayedErrorCode;
  // Fill the code's sentence, like the taken number of SPOT_NUMBER_TAKEN.
  readonly values: Readonly<Record<string, string>>;

  constructor(status: number, code: string | undefined, values: Readonly<Record<string, string>> = {}) {
    super(`Dashboard API answered ${status} ${code ?? ''}`.trim());
    this.name = 'DashboardApiError';
    this.status = status;
    this.code = isDashboardErrorCode(code) ? code : 'UNKNOWN';
    this.values = values;
  }
}

const UNAUTHORIZED = 401;

// The session cookie expired or was revoked while the page was open.
export function endsSession(error: DashboardApiError): boolean {
  return error.status === UNAUTHORIZED;
}

export function asDashboardApiError(error: unknown): DashboardApiError {
  return error instanceof DashboardApiError ? error : new DashboardApiError(0, undefined);
}

import type { DashboardErrorCode } from '@palier/shared-types';
import { DASHBOARD_ERROR_CODES } from '@palier/shared-types/dashboard';

function isDashboardErrorCode(code: string | undefined): code is DashboardErrorCode {
  return DASHBOARD_ERROR_CODES.some((known) => known === code);
}

export type DisplayedErrorCode = DashboardErrorCode | 'UNKNOWN';

// The page shows a dictionary sentence for the code, never the API's English message.
export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: DisplayedErrorCode;

  constructor(status: number, code: string | undefined) {
    super(`Dashboard API answered ${status} ${code ?? ''}`.trim());
    this.name = 'DashboardApiError';
    this.status = status;
    this.code = isDashboardErrorCode(code) ? code : 'UNKNOWN';
  }
}

export function asDashboardApiError(error: unknown): DashboardApiError {
  return error instanceof DashboardApiError ? error : new DashboardApiError(0, undefined);
}

import type { DashboardErrorCode } from '@palier/shared-types';

const KNOWN_CODES: ReadonlySet<string> = new Set<DashboardErrorCode>([
  'UNAUTHORIZED',
  'CSRF_HEADER_MISSING',
  'LEGAL_NAME_INVALID',
  'OPERATOR_EXISTS',
  'NO_OPERATOR',
  'LOT_NOT_FOUND',
]);

export type DisplayedErrorCode = DashboardErrorCode | 'UNKNOWN';

// The page shows a dictionary sentence for the code, never the API's English message.
export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: DisplayedErrorCode;

  constructor(status: number, code: string | undefined) {
    super(`Dashboard API answered ${status} ${code ?? ''}`.trim());
    this.name = 'DashboardApiError';
    this.status = status;
    this.code = code !== undefined && KNOWN_CODES.has(code) ? (code as DashboardErrorCode) : 'UNKNOWN';
  }
}

export function asDashboardApiError(error: unknown): DashboardApiError {
  return error instanceof DashboardApiError ? error : new DashboardApiError(0, undefined);
}

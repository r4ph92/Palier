import type { DashboardErrorCode } from '@palier/shared-types';

const MESSAGES: Record<DashboardErrorCode, string> = {
  UNAUTHORIZED: 'Sign in to the dashboard first.',
  CSRF_HEADER_MISSING: 'This request must come from the dashboard.',
  LEGAL_NAME_INVALID: 'The legal name must be 2 to 120 characters.',
  OPERATOR_EXISTS: 'You already belong to an operator.',
  NO_OPERATOR: 'Create your operator first.',
  LOT_NOT_FOUND: 'No such lot.',
};

export class DashboardRefusedError extends Error {
  readonly reason: DashboardErrorCode;

  constructor(reason: DashboardErrorCode) {
    super(MESSAGES[reason]);
    this.name = 'DashboardRefusedError';
    this.reason = reason;
  }
}

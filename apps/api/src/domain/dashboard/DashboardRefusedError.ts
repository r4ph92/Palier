import type { DashboardErrorCode } from '@palier/shared-types';
import { LEGAL_NAME_LENGTH } from '@palier/shared-types/dashboard';

export type DashboardRefusalReason = Extract<DashboardErrorCode, 'LEGAL_NAME_INVALID' | 'OPERATOR_EXISTS' | 'NO_OPERATOR' | 'LOT_NOT_FOUND' | 'OPERATOR_NOT_FOUND' | 'STRIPE_UNAVAILABLE'>;

const MESSAGES: Readonly<Record<DashboardRefusalReason, string>> = {
  LEGAL_NAME_INVALID: `The legal name must be ${LEGAL_NAME_LENGTH.minimum} to ${LEGAL_NAME_LENGTH.maximum} characters, with no invisible characters.`,
  OPERATOR_EXISTS: 'You already belong to an operator.',
  NO_OPERATOR: 'Create your operator first.',
  LOT_NOT_FOUND: 'No such lot.',
  OPERATOR_NOT_FOUND: 'No such operator.',
  STRIPE_UNAVAILABLE: 'Stripe is unavailable right now.',
};

export class DashboardRefusedError extends Error {
  readonly reason: DashboardRefusalReason;

  constructor(reason: DashboardRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'DashboardRefusedError';
    this.reason = reason;
  }
}

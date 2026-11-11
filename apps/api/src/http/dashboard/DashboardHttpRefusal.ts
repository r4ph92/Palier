import type { DashboardErrorCode } from '@palier/shared-types';

export type DashboardHttpRefusalReason = Extract<DashboardErrorCode, 'UNAUTHORIZED' | 'CSRF_HEADER_MISSING' | 'TOO_MANY_LOTS'>;

const MESSAGES: Readonly<Record<DashboardHttpRefusalReason, string>> = {
  UNAUTHORIZED: 'Sign in to the dashboard first.',
  CSRF_HEADER_MISSING: 'This request must come from the dashboard.',
  TOO_MANY_LOTS: 'Too many lots created in a short time. Try again in an hour.',
};

// Refusals of the request itself (no session, missing header, too many creations), kept apart from the business refusals of the domain.
export class DashboardHttpRefusal extends Error {
  readonly reason: DashboardHttpRefusalReason;

  constructor(reason: DashboardHttpRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'DashboardHttpRefusal';
    this.reason = reason;
  }
}

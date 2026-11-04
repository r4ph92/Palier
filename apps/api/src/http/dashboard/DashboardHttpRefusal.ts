import type { DashboardErrorCode } from '@palier/shared-types';

export type DashboardHttpRefusalReason = Extract<DashboardErrorCode, 'UNAUTHORIZED' | 'CSRF_HEADER_MISSING'>;

const MESSAGES: Readonly<Record<DashboardHttpRefusalReason, string>> = {
  UNAUTHORIZED: 'Sign in to the dashboard first.',
  CSRF_HEADER_MISSING: 'This request must come from the dashboard.',
};

// Refusals of the request itself (no session, missing header), kept apart from the business refusals of the domain.
export class DashboardHttpRefusal extends Error {
  readonly reason: DashboardHttpRefusalReason;

  constructor(reason: DashboardHttpRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'DashboardHttpRefusal';
    this.reason = reason;
  }
}

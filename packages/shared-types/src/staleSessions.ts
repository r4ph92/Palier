import type { AssignedSpot } from './entries.ts';

// The newest sign that the vehicle is still there (Q46, decision 043): the entry loop, a walk to the spot, the driver's answer, or the operator's check.
export const LAST_PROOF_KINDS = ['ENTRY', 'PARKED_ON_FOOT', 'ANSWERED', 'PRESENCE'] as const;
export type LastProofKind = (typeof LAST_PROOF_KINDS)[number];

export const STALE_SESSION_LIST_LIMIT = 200;

export interface DashboardStaleSession {
  readonly id: string;
  readonly plate: string;
  readonly spot: AssignedSpot;
  readonly lastProofAt: string;
  readonly lastProofKind: LastProofKind;
  readonly flaggedAt: string;
}

// The page's whole answer: the lot's name for the title, and its flagged sessions, oldest flag first.
export interface DashboardStaleSessions {
  readonly lotName: string;
  readonly sessions: readonly DashboardStaleSession[];
}

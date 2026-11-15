import type { EntrySessionState } from '@palier/shared-types';
import type { SessionExitMethod, SessionListStatus } from '@palier/shared-types/sessionTimeline';
import type { PresumptionEvidence } from '../parkingSessions/PresumptionEvidence.ts';

// A session as the stored columns say it; the dashboard's views are computed from these facts alone, never from the driver, the card or Stripe.
export interface SessionRecord {
  readonly id: string;
  readonly plate: string;
  readonly state: EntrySessionState;
  readonly enteredAt: Date;
  readonly exitedAt: Date | null;
  readonly assignedSpotNumber: string;
  readonly confirmedSpotNumber: string | null;
  readonly presumedBy: PresumptionEvidence | null;
  readonly wasAnswered: boolean;
  readonly exitMethod: SessionExitMethod | null;
  readonly capturedCents: number | null;
  readonly surplusPaidCents: number;
  readonly pendingCaptureCents: number | null;
  readonly pendingSurplusCents: number;
  readonly unpaidCents: number;
}

export interface StoredSessionEvent {
  readonly sequence: number;
  readonly kind: string;
  readonly occurredAt: Date;
  readonly payload: unknown;
}

export interface SessionPage {
  readonly status: SessionListStatus;
  // The id of the last session of the previous page; one that is not in this lot gives an empty page.
  readonly before: string | null;
  readonly limit: number;
}

export interface SessionListRead {
  readonly lotName: string;
  readonly sessions: readonly SessionRecord[];
}

export interface SessionDetailRead {
  readonly lotName: string;
  // Null when the lot holds no such session; the events come in the order they were written.
  readonly session: (SessionRecord & { readonly events: readonly StoredSessionEvent[] }) | null;
}

// Every statement names the operator and the lot: another operator's lot reads as null, whatever session id is asked.
export interface SessionTimelineRepository {
  // At most `limit` sessions, newest entry first; null when the lot is not the operator's.
  listSessions(operatorId: string, lotId: string, page: SessionPage): Promise<SessionListRead | null>;
  readSession(operatorId: string, lotId: string, sessionId: string): Promise<SessionDetailRead | null>;
}

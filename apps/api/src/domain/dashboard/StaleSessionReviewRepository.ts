import type { AssignedSpot, DashboardErrorCode } from '@palier/shared-types';
import type { SessionProofs } from '../parkingSessions/sessionProofs.ts';

export type PresenceRefusal = Extract<DashboardErrorCode, 'LOT_NOT_FOUND' | 'LOT_BUSY' | 'SESSION_NOT_FOUND'>;

export interface StaleSessionRecord {
  readonly id: string;
  readonly plate: string;
  // The spot the driver answered, else the assigned one.
  readonly spot: AssignedSpot;
  readonly proofs: SessionProofs;
  readonly flaggedAt: Date;
}

export interface StaleSessionListRead {
  readonly lotName: string;
  readonly sessions: readonly StaleSessionRecord[];
}

export interface PresenceCheck {
  readonly lotId: string;
  readonly sessionId: string;
  // Stored on the session, never in the event payload (decision 037).
  readonly memberId: string;
  readonly confirmedAt: Date;
}

// The operator closes the session at its last proof after seeing the spot empty (decision 043).
export interface StaffClosing {
  readonly lotId: string;
  readonly sessionId: string;
  // Stored on the session, never in the event payload (decision 037).
  readonly memberId: string;
  // When the operator closed it: the spot's check flag is dated here, while the exit is dated by the last proof.
  readonly closedAt: Date;
}

// The card hold to cancel once the closing is committed; null for a session with no hold.
export interface ClosedAtLastProof {
  readonly paymentIntentId: string | null;
}

// Every statement names the operator: another operator's lot is LOT_NOT_FOUND before any of its sessions is read.
export interface StaleSessionReviewRepository {
  // The open sessions flagged for a physical check, oldest flag first; null when the lot is not the operator's.
  listStaleSessions(operatorId: string, lotId: string): Promise<StaleSessionListRead | null>;
  // Records the operator's check and clears the flag, in one transaction with its event. An open session that is not flagged (a double click) answers 'CONFIRMED' without writing.
  confirmPresence(operatorId: string, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal>;
  // Closes an active flagged session at its last proof, frees its spot flagged to check and logs the step, in one transaction that
  // also marks the card hold for release. Never captures. A session no longer active or no longer flagged is SESSION_NOT_FOUND.
  closeAtLastProof(operatorId: string, closing: StaffClosing): Promise<ClosedAtLastProof | PresenceRefusal>;
}

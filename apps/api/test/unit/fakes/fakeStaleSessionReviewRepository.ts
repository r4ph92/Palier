import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { ClosedAtLastProof, PresenceCheck, PresenceRefusal, StaffClosing, StaleSessionListRead, StaleSessionReviewRepository } from '../../../src/domain/dashboard/StaleSessionReviewRepository.ts';
import { lastProofOf, type SessionProofs } from '../../../src/domain/parkingSessions/sessionProofs.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

export interface FakeReviewedSession {
  readonly id: string;
  readonly lotId: string;
  readonly plate: string;
  state: EntrySessionState;
  readonly spot: AssignedSpot;
  proofs: SessionProofs;
  staleFlaggedAt: Date | null;
  presenceConfirmedBy: string | null;
  readonly events: string[];
  readonly paymentIntentId?: string | null;
  // What a closing at the last proof writes (story #75).
  exitAt?: Date;
  staffClosedBy?: string;
  holdReleasePending?: boolean;
}

const ACTIVE_STATES: readonly EntrySessionState[] = ACTIVE_ENTRY_SESSION_STATES;

// Keeps the rules the SQL keeps: the operator's lot only, open and flagged sessions oldest flag first, a check clears the flag and logs one event.
export class FakeStaleSessionReviewRepository implements StaleSessionReviewRepository {
  readonly sessions: FakeReviewedSession[] = [];
  readonly busyLots = new Set<string>();
  readonly #lots: FakeLotStore;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  listStaleSessions(operatorId: string, lotId: string): Promise<StaleSessionListRead | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    if (lot === undefined) {
      return Promise.resolve(null);
    }
    const flagged = this.sessions.filter((session) => session.lotId === lotId && isOpen(session) && session.staleFlaggedAt !== null);
    const sessions = flagged.sort((left, right) => (left.staleFlaggedAt?.getTime() ?? 0) - (right.staleFlaggedAt?.getTime() ?? 0));
    return Promise.resolve({ lotName: lot.name, sessions: sessions.flatMap(recordOf) });
  }

  confirmPresence(operatorId: string, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal> {
    if (this.#lots.indexOf(operatorId, check.lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    if (this.busyLots.has(check.lotId)) {
      return Promise.resolve('LOT_BUSY');
    }
    const session = this.sessions.find(({ id, lotId }) => id === check.sessionId && lotId === check.lotId);
    if (session === undefined || !isOpen(session)) {
      return Promise.resolve('SESSION_NOT_FOUND');
    }
    if (session.staleFlaggedAt !== null) {
      session.proofs = { ...session.proofs, presenceConfirmedAt: check.confirmedAt };
      session.staleFlaggedAt = null;
      session.presenceConfirmedBy = check.memberId;
      session.events.push('PRESENCE_CONFIRMED');
    }
    return Promise.resolve('CONFIRMED');
  }

  closeAtLastProof(operatorId: string, closing: StaffClosing): Promise<ClosedAtLastProof | PresenceRefusal> {
    if (this.#lots.indexOf(operatorId, closing.lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    if (this.busyLots.has(closing.lotId)) {
      return Promise.resolve('LOT_BUSY');
    }
    const session = this.sessions.find(({ id, lotId }) => id === closing.sessionId && lotId === closing.lotId);
    const last = session === undefined ? null : lastProofOf(session.proofs);
    if (session === undefined || !isOpen(session) || session.staleFlaggedAt === null || last === null) {
      return Promise.resolve('SESSION_NOT_FOUND');
    }
    const paymentIntentId = session.paymentIntentId ?? null;
    session.state = 'CLOSED_BY_STAFF';
    session.exitAt = last.at;
    session.staffClosedBy = closing.memberId;
    session.staleFlaggedAt = null;
    session.holdReleasePending = paymentIntentId !== null;
    session.events.push('CLOSED_BY_STAFF');
    return Promise.resolve({ paymentIntentId });
  }
}

function isOpen(session: FakeReviewedSession): boolean {
  return ACTIVE_STATES.includes(session.state);
}

function recordOf({ id, plate, spot, proofs, staleFlaggedAt }: FakeReviewedSession): StaleSessionListRead['sessions'] {
  return staleFlaggedAt === null ? [] : [{ id, plate, spot, proofs, flaggedAt: staleFlaggedAt }];
}

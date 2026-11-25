import type { ClosedAtLastProof, PresenceCheck, PresenceRefusal, StaffClosing, StaleSessionListRead, StaleSessionReviewRepository } from '../../domain/dashboard/StaleSessionReviewRepository.ts';
import type { Database, Transaction } from './database.ts';
import { writeInOwnedLot } from './ownedLotWrite.ts';
import { appendSessionEvent, type SessionEventWrite } from './sessionEventStatements.ts';
import { staleSessionListOf, type StaleSessionRow } from './staleSessionReviewRows.ts';
import { closeAtLastProofStatement, confirmPresenceStatement, flagClosedSpotToCheckStatement, lockSessionToConfirmStatement, readStaleSessionsStatement } from './staleSessionReviewStatements.ts';
import { requireUpdatedRow } from './requireUpdatedRow.ts';
import { freeSpots, type ClosedSessionRow } from './sessionSpotRelease.ts';

interface SessionToConfirmRow extends Record<string, unknown> {
  readonly flagged: boolean;
}

interface SessionClosedByStaffRow extends ClosedSessionRow {
  readonly payment_intent_id: string | null;
}

export class PostgresStaleSessionReviewRepository implements StaleSessionReviewRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async listStaleSessions(operatorId: string, lotId: string): Promise<StaleSessionListRead | null> {
    return staleSessionListOf(await this.#database.execute<StaleSessionRow>(readStaleSessionsStatement(operatorId, lotId)));
  }

  confirmPresence(operatorId: string, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: check.lotId }, (tx) => confirmFlaggedSession(tx, check));
  }

  closeAtLastProof(operatorId: string, closing: StaffClosing): Promise<ClosedAtLastProof | PresenceRefusal> {
    return writeInOwnedLot(this.#database, { operatorId, lotId: closing.lotId }, (tx) => closeFlaggedSession(tx, closing));
  }
}

// Lot, then session, then spots: the order the exit takes. The event is dated by the exit_at the update just wrote, the last proof.
async function closeFlaggedSession(tx: Transaction, closing: StaffClosing): Promise<ClosedAtLastProof | PresenceRefusal> {
  const [session] = await tx.execute<SessionClosedByStaffRow>(closeAtLastProofStatement(closing));
  if (session === undefined) {
    return 'SESSION_NOT_FOUND';
  }
  await freeSpots(tx, { sessionId: closing.sessionId, session, now: closing.closedAt });
  await tx.execute(flagClosedSpotToCheckStatement(session.confirmed_spot_id ?? session.assigned_spot_id, closing.closedAt));
  await appendSessionEvent(tx, { sessionId: closing.sessionId, lotId: closing.lotId, occurredAt: 'exit_at', event: { kind: 'CLOSED_BY_STAFF', payload: {} } });
  return { paymentIntentId: session.payment_intent_id };
}

async function confirmFlaggedSession(tx: Transaction, check: PresenceCheck): Promise<'CONFIRMED' | PresenceRefusal> {
  const [session] = await tx.execute<SessionToConfirmRow>(lockSessionToConfirmStatement(check));
  if (session === undefined) {
    return 'SESSION_NOT_FOUND';
  }
  if (session.flagged) {
    requireUpdatedRow(await tx.execute(confirmPresenceStatement(check)), `Session ${check.sessionId} could not be confirmed under its lock.`);
    await appendSessionEvent(tx, presenceEventOf(check));
  }
  return 'CONFIRMED';
}

// Dated by the presence column the update just wrote, with an empty payload: who checked is on the session, not in the log.
function presenceEventOf({ sessionId, lotId }: PresenceCheck): SessionEventWrite {
  return { sessionId, lotId, occurredAt: 'presence_confirmed_at', event: { kind: 'PRESENCE_CONFIRMED', payload: {} } };
}

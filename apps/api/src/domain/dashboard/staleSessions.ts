import type { DashboardStaleSession, DashboardStaleSessions } from '@palier/shared-types';
import type { JobLog } from '../JobLog.ts';
import { lastProofOf } from '../parkingSessions/sessionProofs.ts';
import type { Clock } from '../time/Clock.ts';
import type { CardHoldCanceller } from './CardHoldCanceller.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';
import type { MemberSession } from './sessionTimelines.ts';
import type { StaleSessionRecord, StaleSessionReviewRepository } from './StaleSessionReviewRepository.ts';

export interface StaleSessionSources {
  readonly operators: MemberOperators;
  readonly staleSessions: StaleSessionReviewRepository;
  readonly clock: Clock;
  // Null without a Stripe key: the session still closes, its hold waits for the release job (#50).
  readonly holds: CardHoldCanceller | null;
}

export async function listStaleSessionsOfMember(sources: StaleSessionSources, lot: MemberLot): Promise<DashboardStaleSessions> {
  return listOwnedStaleSessions(sources.staleSessions, await operatorIdOfMember(sources.operators, lot), lot.lotId);
}

// Answers the list after the check, so the page shows what is still flagged.
export async function confirmPresenceOfMember(sources: StaleSessionSources, member: MemberSession): Promise<DashboardStaleSessions> {
  const operatorId = await operatorIdOfMember(sources.operators, member);
  const outcome = await sources.staleSessions.confirmPresence(operatorId, {
    lotId: member.lotId,
    sessionId: member.sessionId,
    memberId: member.userId,
    confirmedAt: sources.clock(),
  });
  if (outcome !== 'CONFIRMED') {
    throw new DashboardRefusedError(outcome);
  }
  return listOwnedStaleSessions(sources.staleSessions, operatorId, member.lotId);
}

// Closes the session first, then cancels its card hold outside the transaction, like every other cancellation: a hold Stripe could not
// release stays marked and the release job retries it, the session staying closed. Answers the list that remains.
export async function closeAtLastProofOfMember(sources: StaleSessionSources, member: MemberSession, log: JobLog): Promise<DashboardStaleSessions> {
  const operatorId = await operatorIdOfMember(sources.operators, member);
  const closed = await sources.staleSessions.closeAtLastProof(operatorId, {
    lotId: member.lotId,
    sessionId: member.sessionId,
    memberId: member.userId,
    closedAt: sources.clock(),
  });
  if (typeof closed === 'string') {
    throw new DashboardRefusedError(closed);
  }
  await cancelCardHold(sources.holds, { sessionId: member.sessionId, paymentIntentId: closed.paymentIntentId }, log);
  return listOwnedStaleSessions(sources.staleSessions, operatorId, member.lotId);
}

interface HoldToCancel {
  readonly sessionId: string;
  readonly paymentIntentId: string | null;
}

// The job releases the hold again after an immediate release here (Stripe answers already cancelled, harmless) and retries one that failed.
async function cancelCardHold(holds: CardHoldCanceller | null, { sessionId, paymentIntentId }: HoldToCancel, log: JobLog): Promise<void> {
  if (holds === null || paymentIntentId === null) {
    return;
  }
  try {
    const release = await holds.cancel(paymentIntentId);
    if (release !== 'released') {
      log.warn({ sessionId, release }, 'the card hold of a session closed by staff was not released, retried by the release job');
    }
  } catch (error) {
    log.error({ err: error, sessionId }, 'the card hold of a session closed by staff was not released, retried by the release job');
  }
}

async function listOwnedStaleSessions(staleSessions: StaleSessionReviewRepository, operatorId: string, lotId: string): Promise<DashboardStaleSessions> {
  const read = ownedLotOrNotFound(await staleSessions.listStaleSessions(operatorId, lotId));
  return { lotName: read.lotName, sessions: read.sessions.flatMap(staleSessionOf) };
}

// A flagged session always has a proof, since only a proof can be old enough to flag; one without is left out rather than shown with an invented date.
function staleSessionOf({ id, plate, spot, proofs, flaggedAt }: StaleSessionRecord): DashboardStaleSession[] {
  const last = lastProofOf(proofs);
  if (last === null) {
    return [];
  }
  return [{ id, plate, spot, lastProofAt: last.at.toISOString(), lastProofKind: last.kind, flaggedAt: flaggedAt.toISOString() }];
}

import type { DashboardStaleSession, DashboardStaleSessions } from '@palier/shared-types';
import { lastProofOf } from '../parkingSessions/sessionProofs.ts';
import type { Clock } from '../time/Clock.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';
import type { MemberSession } from './sessionTimelines.ts';
import type { StaleSessionRecord, StaleSessionReviewRepository } from './StaleSessionReviewRepository.ts';

export interface StaleSessionSources {
  readonly operators: MemberOperators;
  readonly staleSessions: StaleSessionReviewRepository;
  readonly clock: Clock;
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

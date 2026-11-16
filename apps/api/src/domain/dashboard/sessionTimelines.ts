import type { DashboardSessionDetail, DashboardSessionList } from '@palier/shared-types';
import { SESSION_LIST_PAGE_SIZE, type SessionListStatus } from '@palier/shared-types/sessionTimeline';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';
import { sessionRowOf, sessionSummaryOf } from './sessionSummary.ts';
import { timelineOf } from './sessionTimeline.ts';
import type { SessionTimelineRepository } from './SessionTimelineRepository.ts';

export interface SessionTimelineSources {
  readonly operators: MemberOperators;
  readonly sessions: SessionTimelineRepository;
}

export interface MemberSession extends MemberLot {
  readonly sessionId: string;
}

export interface SessionListRequest {
  readonly status: SessionListStatus;
  readonly before: string | null;
}

// One more session than the page holds tells whether older ones exist, without counting them.
export async function listSessionsOfMember(sources: SessionTimelineSources, lot: MemberLot, request: SessionListRequest): Promise<DashboardSessionList> {
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  const read = ownedLotOrNotFound(await sources.sessions.listSessions(operatorId, lot.lotId, { ...request, limit: SESSION_LIST_PAGE_SIZE + 1 }));
  const page = read.sessions.slice(0, SESSION_LIST_PAGE_SIZE);
  const last = page.at(-1);
  const hasOlder = read.sessions.length > SESSION_LIST_PAGE_SIZE;
  return { lotName: read.lotName, sessions: page.map(sessionRowOf), nextCursor: hasOlder && last !== undefined ? last.id : null };
}

export async function readSessionOfMember(sources: SessionTimelineSources, member: MemberSession): Promise<DashboardSessionDetail> {
  const operatorId = await operatorIdOfMember(sources.operators, member);
  const read = ownedLotOrNotFound(await sources.sessions.readSession(operatorId, member.lotId, member.sessionId));
  if (read.session === null) {
    throw new DashboardRefusedError('SESSION_NOT_FOUND');
  }
  return { lotName: read.lotName, summary: sessionSummaryOf(read.session), timeline: timelineOf(read.session.events) };
}

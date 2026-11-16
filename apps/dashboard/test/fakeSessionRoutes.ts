import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { SESSION_LIST_PAGE_SIZE } from '@palier/shared-types/sessionTimeline';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';
import { rowOf, type FakeVisit } from './fakeSessionData.ts';

const SESSIONS_REQUEST = /^GET \/lots\/([^/?]+)\/sessions(?:\?(.*))?$/;
const SESSION_REQUEST = /^GET \/lots\/([^/?]+)\/sessions\/([^/?]+)$/;

export function isSessionRequest(request: string): boolean {
  return SESSIONS_REQUEST.test(request) || SESSION_REQUEST.test(request);
}

interface MemberSessions {
  readonly sessions: FakeApiState['sessions'];
  readonly ownedLotIds: ReadonlySet<string>;
}

// Keeps the API's rules: a member's own lot, open means an active state, the list is held in order and paged after the cursor.
export function routeSessions({ sessions, ownedLotIds }: MemberSessions, request: string): FakeResponse {
  const [, listLotId, query = ''] = SESSIONS_REQUEST.exec(request) ?? [];
  const [, detailLotId, sessionId = ''] = SESSION_REQUEST.exec(request) ?? [];
  const lotId = listLotId ?? detailLotId ?? '';
  if (!ownedLotIds.has(lotId)) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const visits = sessions.get(lotId) ?? [];
  return listLotId === undefined ? detailOf(visits, sessionId) : listOf(visits, new URLSearchParams(query));
}

function detailOf(visits: readonly FakeVisit[], sessionId: string): FakeResponse {
  const visit = visits.find(({ id }) => id === sessionId);
  return visit === undefined ? refused(404, 'SESSION_NOT_FOUND') : { status: 200, body: visit.detail };
}

function listOf(visits: readonly FakeVisit[], query: URLSearchParams): FakeResponse {
  const wanted = query.get('status') === 'ALL' ? visits : visits.filter(({ detail }) => (ACTIVE_ENTRY_SESSION_STATES as readonly string[]).includes(detail.summary.state));
  const before = query.get('before');
  const start = before === null ? 0 : wanted.findIndex(({ id }) => id === before) + 1;
  const page = wanted.slice(start, start + SESSION_LIST_PAGE_SIZE);
  const hasOlder = start + SESSION_LIST_PAGE_SIZE < wanted.length;
  return { status: 200, body: { lotName: 'Parking Démo', sessions: page.map(rowOf), nextCursor: hasOlder ? (page.at(-1)?.id ?? null) : null } };
}

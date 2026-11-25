import type { DashboardLotDetails } from '@palier/shared-types';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';

const STALE_SESSIONS_REQUEST = /^GET \/lots\/([^/]+)\/stale-sessions$/;
// A presence check and a closing at the last proof both take the session off the flagged list.
const PRESENCE_REQUEST = /^POST \/lots\/([^/]+)\/stale-sessions\/([^/]+)\/(?:presence|close)$/;

export function isStaleSessionRequest(request: string): boolean {
  return STALE_SESSIONS_REQUEST.test(request) || PRESENCE_REQUEST.test(request);
}

interface MemberStaleSessions {
  readonly staleSessions: FakeApiState['staleSessions'];
  readonly lots: readonly DashboardLotDetails[];
}

// Keeps the API's rules: a member's own lot, and a presence check or a closing only on a session still in the flagged list.
export function routeStaleSessions({ staleSessions, lots }: MemberStaleSessions, request: string): FakeResponse {
  const [, readLotId] = STALE_SESSIONS_REQUEST.exec(request) ?? [];
  const [, confirmLotId = '', sessionId = ''] = PRESENCE_REQUEST.exec(request) ?? [];
  const lotId = readLotId ?? confirmLotId;
  const lot = lots.find(({ id }) => id === lotId);
  if (lot === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const flagged = staleSessions.get(lotId) ?? [];
  if (readLotId !== undefined) {
    return { status: 200, body: { lotName: lot.name, sessions: flagged } };
  }
  if (!flagged.some(({ id }) => id === sessionId)) {
    return refused(404, 'SESSION_NOT_FOUND');
  }
  const remaining = flagged.filter(({ id }) => id !== sessionId);
  staleSessions.set(lotId, remaining);
  return { status: 200, body: { lotName: lot.name, sessions: remaining } };
}

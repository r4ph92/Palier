import type { DashboardSpotToCheck } from '@palier/shared-types';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';

const SPOTS_TO_CHECK_REQUEST = /^GET \/lots\/([^/]+)\/spots-to-check$/;
const CHECK_CLEARED_REQUEST = /^POST \/lots\/([^/]+)\/spots\/([^/]+)\/check-cleared$/;

export function isSpotCheckRequest(request: string): boolean {
  return SPOTS_TO_CHECK_REQUEST.test(request) || CHECK_CLEARED_REQUEST.test(request);
}

interface MemberSpotChecks {
  readonly spotsToCheck: FakeApiState['spotsToCheck'];
  readonly ownedLotIds: ReadonlySet<string>;
}

// Keeps the API's rules: a member's own lot, and a clear only on a flagged spot that is free.
export function routeSpotChecks({ spotsToCheck, ownedLotIds }: MemberSpotChecks, request: string): FakeResponse {
  const [, readLotId] = SPOTS_TO_CHECK_REQUEST.exec(request) ?? [];
  const [, clearLotId = '', spotId = ''] = CHECK_CLEARED_REQUEST.exec(request) ?? [];
  const lotId = readLotId ?? clearLotId;
  if (!ownedLotIds.has(lotId)) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const flagged = spotsToCheck.get(lotId) ?? [];
  return readLotId === undefined ? clearSpot(spotsToCheck, { lotId, spotId }, flagged) : { status: 200, body: flagged };
}

function clearSpot(spotsToCheck: FakeApiState['spotsToCheck'], { lotId, spotId }: { readonly lotId: string; readonly spotId: string }, flagged: readonly DashboardSpotToCheck[]): FakeResponse {
  if (flagged.some((spot) => spot.spotId === spotId && spot.state !== 'AVAILABLE')) {
    return refused(409, 'SPOT_STILL_ASSIGNED');
  }
  const remaining = flagged.filter((spot) => spot.spotId !== spotId);
  spotsToCheck.set(lotId, remaining);
  return { status: 200, body: remaining };
}

import type { DashboardLotDetails, DashboardSpotToCheck } from '@palier/shared-types';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';

const SPOTS_TO_CHECK_REQUEST = /^GET \/lots\/([^/]+)\/spots-to-check$/;
const CHECK_CLEARED_REQUEST = /^POST \/lots\/([^/]+)\/spots\/([^/]+)\/check-cleared$/;

export function isSpotCheckRequest(request: string): boolean {
  return SPOTS_TO_CHECK_REQUEST.test(request) || CHECK_CLEARED_REQUEST.test(request);
}

interface MemberSpotChecks {
  readonly spotsToCheck: FakeApiState['spotsToCheck'];
  readonly lots: readonly DashboardLotDetails[];
}

// Keeps the API's rules: a member's own lot, and a clear only on a flagged spot that is free.
export function routeSpotChecks({ spotsToCheck, lots }: MemberSpotChecks, request: string): FakeResponse {
  const [, readLotId] = SPOTS_TO_CHECK_REQUEST.exec(request) ?? [];
  const [, clearLotId = '', spotId = ''] = CHECK_CLEARED_REQUEST.exec(request) ?? [];
  const lotId = readLotId ?? clearLotId;
  const lot = lots.find(({ id }) => id === lotId);
  if (lot === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const flagged = spotsToCheck.get(lotId) ?? [];
  return readLotId === undefined ? clearSpot(spotsToCheck, { lot, spotId }, flagged) : { status: 200, body: { lotName: lot.name, spots: flagged } };
}

function clearSpot(spotsToCheck: FakeApiState['spotsToCheck'], { lot, spotId }: { readonly lot: DashboardLotDetails; readonly spotId: string }, flagged: readonly DashboardSpotToCheck[]): FakeResponse {
  const refusedSpot = flagged.find((spot) => spot.spotId === spotId && !spot.clearable);
  if (refusedSpot !== undefined) {
    return refused(409, refusalOf(refusedSpot));
  }
  const remaining = flagged.filter((spot) => spot.spotId !== spotId);
  spotsToCheck.set(lot.id, remaining);
  return { status: 200, body: { lotName: lot.name, spots: remaining } };
}

// As the API's clearDecisionOf: a session or a hold still has it, or it is not free with nothing to wait for.
function refusalOf({ state, heldBySession }: DashboardSpotToCheck): 'SPOT_STILL_ASSIGNED' | 'SPOT_NOT_FREE' {
  return heldBySession || ['AVAILABLE', 'HELD', 'ASSIGNED'].includes(state) ? 'SPOT_STILL_ASSIGNED' : 'SPOT_NOT_FREE';
}

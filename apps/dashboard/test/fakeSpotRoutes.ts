import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { addSpotsErrors, spotAttributesErrors, spotNumbersOf, type AddSpotsRequest, type SpotAttributes, type SpotDraftErrors } from '@palier/shared-types/spotDraft';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';
import type { FakeSpot } from './fakeSpotData.ts';

const AISLE_SPOTS_REQUEST = /^(GET|POST) \/lots\/([^/]+)\/aisles\/([^/]+)\/spots$/;
const SPOT_REQUEST = /^(PUT|DELETE) \/lots\/([^/]+)\/spots\/([^/]+)$/;
const FREE_STATES: readonly string[] = ['AVAILABLE', 'OUT_OF_SERVICE'];

let nextId = 0;

export function isSpotRequest(request: string): boolean {
  return AISLE_SPOTS_REQUEST.test(request) || SPOT_REQUEST.test(request);
}

interface MemberLot {
  readonly state: FakeApiState;
  readonly lotId: string;
  readonly isOwned: boolean;
}

export interface MemberSpots {
  readonly state: FakeApiState;
  readonly ownedLotIds: ReadonlySet<string>;
}

// Keeps the API's rules: a member's own lot, a parking aisle, numbers taken in the lot, spots in use kept.
export function routeSpots({ state, ownedLotIds }: MemberSpots, request: string, body: Record<string, unknown>): FakeResponse {
  const [, method, lotId = '', id = ''] = AISLE_SPOTS_REQUEST.exec(request) ?? SPOT_REQUEST.exec(request) ?? [];
  const lot = { state, lotId, isOwned: ownedLotIds.has(lotId) };
  if (method === 'GET' || method === 'POST') {
    return method === 'GET' ? readSpots(lot, id) : addSpots(lot, id, body as unknown as AddSpotsRequest);
  }
  return method === 'PUT' ? changeSpot(lot, id, body as unknown as SpotAttributes) : deleteSpot(lot, id);
}

function readSpots(lot: MemberLot, aisleId: string): FakeResponse {
  return isParkingAisle(lot, aisleId) ? { status: 200, body: aisleSpotsOf(lot, aisleId) } : refused(404, 'AISLE_NOT_FOUND');
}

function addSpots(lot: MemberLot, aisleId: string, request: AddSpotsRequest): FakeResponse {
  if (!lot.isOwned) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  if (!isParkingAisle(lot, aisleId)) {
    return refused(404, 'AISLE_NOT_FOUND');
  }
  const invalid = firstErrorOf(addSpotsErrors(request));
  if (invalid !== undefined) {
    return refused(400, invalid);
  }
  const numbers = spotNumbersOf(request.range);
  const taken = numbers.map((number) => takenSpotOf(lot, number)).find((spot) => spot !== undefined);
  if (taken !== undefined) {
    return refusedAsTaken(taken.number);
  }
  spotsOf(lot).push(...numbers.map((number) => ({ id: newId(), aisleId, number, state: 'AVAILABLE' as const, ...request.attributes })));
  return { status: 201, body: aisleSpotsOf(lot, aisleId) };
}

function changeSpot(lot: MemberLot, spotId: string, attributes: SpotAttributes): FakeResponse {
  const spot = liveSpotOf(lot, spotId);
  if (typeof spot === 'string') {
    return refused(404, spot);
  }
  const invalid = firstErrorOf(spotAttributesErrors(attributes));
  if (invalid !== undefined) {
    return refused(400, invalid);
  }
  Object.assign(spot, attributes);
  return { status: 200, body: aisleSpotsOf(lot, spot.aisleId) };
}

function deleteSpot(lot: MemberLot, spotId: string): FakeResponse {
  const spot = liveSpotOf(lot, spotId);
  if (typeof spot === 'string') {
    return refused(404, spot);
  }
  if (!FREE_STATES.includes(spot.state)) {
    return refused(409, 'SPOT_IN_USE');
  }
  spotsOf(lot).splice(spotsOf(lot).indexOf(spot), 1);
  return { status: 200, body: aisleSpotsOf(lot, spot.aisleId) };
}

function liveSpotOf(lot: MemberLot, spotId: string): FakeSpot | 'LOT_NOT_FOUND' | 'SPOT_NOT_FOUND' {
  if (!lot.isOwned) {
    return 'LOT_NOT_FOUND';
  }
  return spotsOf(lot).find(({ id }) => id === spotId) ?? 'SPOT_NOT_FOUND';
}

function isParkingAisle({ state, lotId, isOwned }: MemberLot, aisleId: string): boolean {
  const levels = isOwned ? (state.maps.get(lotId)?.levels ?? []) : [];
  return levels.some(({ aisles }) => aisles.some(({ id, isExitLane }) => id === aisleId && !isExitLane));
}

function spotsOf({ state, lotId }: MemberLot): FakeSpot[] {
  const spots = state.spots.get(lotId) ?? [];
  state.spots.set(lotId, spots);
  return spots;
}

function aisleSpotsOf(lot: MemberLot, aisleId: string): DashboardAisleSpots {
  const capacity = [...lot.state.lots.values()].flat().find(({ id }) => id === lot.lotId)?.capacity ?? 0;
  const spots = spotsOf(lot);
  return { aisleId, spots: spots.filter((spot) => spot.aisleId === aisleId).map(dashboardSpotOf), spotCount: spots.length, capacity };
}

function dashboardSpotOf({ id, number, state, isEv, isAccessible, isOversize, distanceToExit }: FakeSpot): DashboardSpot {
  return { id, number, state, isEv, isAccessible, isOversize, distanceToExit };
}

function firstErrorOf(errors: SpotDraftErrors): string | undefined {
  return Object.values(errors).find((code) => code !== undefined);
}

function takenSpotOf(lot: MemberLot, number: string): FakeSpot | undefined {
  return spotsOf(lot).find((spot) => canonicalSpotNumber(spot.number) === canonicalSpotNumber(number));
}

function refusedAsTaken(number: string): FakeResponse {
  const refusal = refused(409, 'SPOT_NUMBER_TAKEN');
  return { ...refusal, body: { ...(refusal.body as object), values: { number } } };
}

function newId(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(800_000_000_000 + nextId)}`;
}

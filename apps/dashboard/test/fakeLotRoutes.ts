import type { DashboardLotDetails, LotDraft, LotPricing } from '@palier/shared-types';
import { type FakeApiState, type FakeResponse, refused, summaryOf } from './fakeDashboardData.ts';

export const CREATED_LOT_ID = '00000000-0000-4000-8000-000000000299';
const FIRST_CREATED_MAJOR = 4;
const PRICING_PATH = /^PUT \/lots\/([^/]+)\/pricing$/;

// Only a member's own lots answer; any other id is not found, as in the API.
export function routeLots(state: FakeApiState, request: string, body: Record<string, unknown>): FakeResponse {
  const operatorId = state.me?.operator?.id;
  if (operatorId === undefined) {
    return refusedWithoutOperator(request);
  }
  const lots = state.lots.get(operatorId) ?? [];
  state.lots.set(operatorId, lots);
  if (request === 'GET /lots') {
    return { status: 200, body: lots.map(summaryOf) };
  }
  if (request === 'POST /lots') {
    return createLot(lots, body as unknown as LotDraft);
  }
  const pricingLotId = PRICING_PATH.exec(request)?.[1];
  return pricingLotId === undefined ? readLot(lots, request) : setPricing(lots, pricingLotId, body as unknown as LotPricing);
}

function refusedWithoutOperator(request: string): FakeResponse {
  return request === 'GET /lots' || request === 'POST /lots' ? refused(409, 'NO_OPERATOR') : refused(404, 'LOT_NOT_FOUND');
}

function readLot(lots: readonly DashboardLotDetails[], request: string): FakeResponse {
  const lot = lots.find(({ id }) => request === `GET /lots/${id}`);
  return lot === undefined ? refused(404, 'LOT_NOT_FOUND') : { status: 200, body: lot };
}

function createLot(lots: DashboardLotDetails[], draft: LotDraft): FakeResponse {
  const created: DashboardLotDetails = { ...draft, id: CREATED_LOT_ID, isOnline: false, beaconMajor: FIRST_CREATED_MAJOR, pricing: null };
  lots.push(created);
  return { status: 201, body: created };
}

function setPricing(lots: DashboardLotDetails[], lotId: string, pricing: LotPricing): FakeResponse {
  const index = lots.findIndex(({ id }) => id === lotId);
  const lot = lots[index];
  if (lot === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  lots[index] = { ...lot, pricing };
  return { status: 200, body: lots[index] };
}

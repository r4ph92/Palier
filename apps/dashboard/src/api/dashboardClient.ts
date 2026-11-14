import type {
  AddSpotsRequest,
  AisleRequest,
  DashboardAisleSpots,
  DashboardLotDetails,
  DashboardLotListResponse,
  DashboardLotMap,
  DashboardLotOccupancy,
  DashboardMeResponse,
  DashboardOperator,
  DashboardSpotsToCheck,
  LevelDraft,
  LevelOrderRequest,
  LotDraft,
  LotPricingRequest,
  SpotAttributes,
  StripeOnboardingLink,
} from '@palier/shared-types';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import { DashboardApiError } from './DashboardApiError.ts';

const BASE_PATH = '/v1/dashboard';
const NO_CONTENT = 204;
const JSON_TYPE = 'application/json';
// Shorter than the 30 s occupancy poll, so a read that never answers counts as a failed poll before the next one starts.
const READ_TIMEOUT_MILLISECONDS = 20_000;

interface DashboardRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: object;
}

const READ: DashboardRequest = { method: 'GET' };

function lotPathOf(lotId: string): string {
  return `/lots/${encodeURIComponent(lotId)}`;
}

// The session travels in an HttpOnly cookie the page never sees; writes add the header the API demands against CSRF.
function requestInit({ method, body }: DashboardRequest): RequestInit {
  if (method === 'GET') {
    return { method, credentials: 'same-origin', headers: { accept: JSON_TYPE } };
  }
  const contentType = body === undefined ? {} : { 'content-type': JSON_TYPE };
  const headers = { accept: JSON_TYPE, [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE, ...contentType };
  return { method, credentials: 'same-origin', headers, body: body === undefined ? null : JSON.stringify(body) };
}

// Only reads time out: a write aborted by the client may still commit on the server, and retrying it would duplicate it.
export async function dashboardRequest<T>(path: string, request: DashboardRequest = READ): Promise<T> {
  const controller = new AbortController();
  const timer = request.method === 'GET' ? setTimeout(() => controller.abort(), READ_TIMEOUT_MILLISECONDS) : undefined;
  try {
    const response = await fetch(`${BASE_PATH}${path}`, { ...requestInit(request), signal: controller.signal });
    if (!response.ok) {
      const { error, values } = await errorBodyOf(response);
      throw new DashboardApiError(response.status, error, values);
    }
    return (response.status === NO_CONTENT ? undefined : await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface ErrorBody {
  readonly error: string | undefined;
  readonly values: Readonly<Record<string, string>>;
}

// Only text values fill a sentence: anything else in the body is left out.
async function errorBodyOf(response: Response): Promise<ErrorBody> {
  try {
    const { error, values } = (await response.json()) as { error?: string; values?: unknown };
    return { error, values: textValuesOf(values) };
  } catch {
    return { error: undefined, values: {} };
  }
}

function textValuesOf(values: unknown): Readonly<Record<string, string>> {
  if (typeof values !== 'object' || values === null) {
    return {};
  }
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function spotsPathOf(lotId: string, aisleId: string): string {
  return `${lotPathOf(lotId)}/aisles/${encodeURIComponent(aisleId)}/spots`;
}

function spotPathOf(lotId: string, spotId: string): string {
  return `${lotPathOf(lotId)}/spots/${encodeURIComponent(spotId)}`;
}

export const dashboardClient = {
  me: () => dashboardRequest<DashboardMeResponse>('/me'),
  signOut: () => dashboardRequest<undefined>('/sign-out', { method: 'POST' }),
  createOperator: (legalName: string) => dashboardRequest<DashboardOperator>('/operators', { method: 'POST', body: { legalName } }),
  startStripeOnboarding: (operatorId: string) =>
    dashboardRequest<StripeOnboardingLink>(`/operators/${encodeURIComponent(operatorId)}/stripe-onboarding`, { method: 'POST' }),
  lots: () => dashboardRequest<DashboardLotListResponse>('/lots'),
  lot: (lotId: string) => dashboardRequest<DashboardLotDetails>(`/lots/${encodeURIComponent(lotId)}`),
  lotOccupancy: (lotId: string) => dashboardRequest<DashboardLotOccupancy>(`/lots/${encodeURIComponent(lotId)}/occupancy`),
  createLot: (draft: LotDraft) => dashboardRequest<DashboardLotDetails>('/lots', { method: 'POST', body: draft }),
  setLotPricing: (lotId: string, pricing: LotPricingRequest) =>
    dashboardRequest<DashboardLotDetails>(`/lots/${encodeURIComponent(lotId)}/pricing`, { method: 'PUT', body: pricing }),
  lotMap: (lotId: string) => dashboardRequest<DashboardLotMap>(`${lotPathOf(lotId)}/map`),
  addLevel: (lotId: string, draft: LevelDraft) => dashboardRequest<DashboardLotMap>(`${lotPathOf(lotId)}/levels`, { method: 'POST', body: draft }),
  reorderLevels: (lotId: string, order: LevelOrderRequest) =>
    dashboardRequest<DashboardLotMap>(`${lotPathOf(lotId)}/levels/order`, { method: 'PUT', body: order }),
  addAisle: (lotId: string, levelId: string, aisle: AisleRequest) =>
    dashboardRequest<DashboardLotMap>(`${lotPathOf(lotId)}/levels/${encodeURIComponent(levelId)}/aisles`, { method: 'POST', body: aisle }),
  aisleSpots: (lotId: string, aisleId: string) => dashboardRequest<DashboardAisleSpots>(spotsPathOf(lotId, aisleId)),
  addSpots: (lotId: string, aisleId: string, request: AddSpotsRequest) =>
    dashboardRequest<DashboardAisleSpots>(spotsPathOf(lotId, aisleId), { method: 'POST', body: request }),
  changeSpot: (lotId: string, spotId: string, attributes: SpotAttributes) =>
    dashboardRequest<DashboardAisleSpots>(spotPathOf(lotId, spotId), { method: 'PUT', body: attributes }),
  deleteSpot: (lotId: string, spotId: string) => dashboardRequest<DashboardAisleSpots>(spotPathOf(lotId, spotId), { method: 'DELETE' }),
  spotsToCheck: (lotId: string) => dashboardRequest<DashboardSpotsToCheck>(`${lotPathOf(lotId)}/spots-to-check`),
  clearSpotCheck: (lotId: string, spotId: string) =>
    dashboardRequest<DashboardSpotsToCheck>(`${spotPathOf(lotId, spotId)}/check-cleared`, { method: 'POST' }),
};

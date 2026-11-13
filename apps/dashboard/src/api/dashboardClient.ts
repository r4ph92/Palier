import type {
  DashboardLotDetails,
  DashboardLotListResponse,
  DashboardLotOccupancy,
  DashboardMeResponse,
  DashboardOperator,
  LotDraft,
  LotPricingRequest,
  StripeOnboardingLink,
} from '@palier/shared-types';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import { DashboardApiError } from './DashboardApiError.ts';

const BASE_PATH = '/v1/dashboard';
const NO_CONTENT = 204;
const JSON_TYPE = 'application/json';
// Shorter than the 30 s occupancy poll, so an answer that never comes counts as a failed poll before the next one starts.
export const REQUEST_TIMEOUT_MILLISECONDS = 20_000;

interface DashboardRequest {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly body?: object;
}

const READ: DashboardRequest = { method: 'GET' };

// The session travels in an HttpOnly cookie the page never sees; writes add the header the API demands against CSRF.
function requestInit({ method, body }: DashboardRequest): RequestInit {
  if (method === 'GET') {
    return { method, credentials: 'same-origin', headers: { accept: JSON_TYPE } };
  }
  const contentType = body === undefined ? {} : { 'content-type': JSON_TYPE };
  const headers = { accept: JSON_TYPE, [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE, ...contentType };
  return { method, credentials: 'same-origin', headers, body: body === undefined ? null : JSON.stringify(body) };
}

export async function dashboardRequest<T>(path: string, request: DashboardRequest = READ): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetch(`${BASE_PATH}${path}`, { ...requestInit(request), signal: controller.signal });
    if (!response.ok) {
      throw new DashboardApiError(response.status, await errorCodeOf(response));
    }
    return (response.status === NO_CONTENT ? undefined : await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    return ((await response.json()) as { error?: string }).error;
  } catch {
    return undefined;
  }
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
};

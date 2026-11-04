import type {
  DashboardLot,
  DashboardLotListResponse,
  DashboardMeResponse,
  DashboardOperator,
} from '@palier/shared-types';
import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import { DashboardApiError } from './DashboardApiError.ts';

const BASE_PATH = '/v1/dashboard';
const NO_CONTENT = 204;
const JSON_TYPE = 'application/json';

interface DashboardRequest {
  readonly method: 'GET' | 'POST';
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
  const response = await fetch(`${BASE_PATH}${path}`, requestInit(request));
  if (!response.ok) {
    throw new DashboardApiError(response.status, await errorCodeOf(response));
  }
  return (response.status === NO_CONTENT ? undefined : await response.json()) as T;
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
  lots: () => dashboardRequest<DashboardLotListResponse>('/lots'),
  lot: (lotId: string) => dashboardRequest<DashboardLot>(`/lots/${encodeURIComponent(lotId)}`),
};

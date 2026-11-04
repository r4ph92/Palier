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

// The session travels in an HttpOnly cookie the page never sees; writes add the header the API demands against CSRF.
export async function dashboardRequest<T>(path: string, body?: object): Promise<T> {
  const init: RequestInit = { credentials: 'same-origin', headers: { accept: 'application/json' } };
  if (body !== undefined) {
    init.method = 'POST';
    init.headers = { accept: 'application/json', 'content-type': 'application/json', [DASHBOARD_CSRF_HEADER]: DASHBOARD_CSRF_VALUE };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_PATH}${path}`, init);
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
  signOut: () => dashboardRequest<undefined>('/sign-out', {}),
  createOperator: (legalName: string) => dashboardRequest<DashboardOperator>('/operators', { legalName }),
  lots: () => dashboardRequest<DashboardLotListResponse>('/lots'),
  lot: (lotId: string) => dashboardRequest<DashboardLot>(`/lots/${encodeURIComponent(lotId)}`),
};

import type { DashboardOperator } from '@palier/shared-types';
import { type FakeApiState, lotsByOperator, meFor, testUsers } from './fakeDashboardData.ts';

export interface FakeResponse {
  readonly status: number;
  readonly body?: unknown;
}

const refused = (status: number, error: string): FakeResponse => ({ status, body: { statusCode: status, error, message: error } });

export function routeRequest(state: FakeApiState, url: string, init: RequestInit = {}): FakeResponse {
  const method = init.method ?? 'GET';
  const path = url.replace('/v1/dashboard', '');
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, string>) : {};
  state.requests.push(`${method} ${path}`);
  if (path.startsWith('/test/')) {
    return routeTestRequest(state, path, body);
  }
  if (path === '/sign-out') {
    state.me = null;
    return { status: 204 };
  }
  return state.me === null ? refused(401, 'UNAUTHORIZED') : routeSignedIn(state, `${method} ${path}`, body);
}

function routeTestRequest(state: FakeApiState, path: string, body: Record<string, string>): FakeResponse {
  const user = testUsers.find(({ id }) => id === body['userId']);
  if (!state.testUsersListed) {
    return refused(404, 'Not Found');
  }
  if (path === '/test/users') {
    return { status: 200, body: testUsers };
  }
  state.me = user === undefined ? null : meFor(user);
  return user === undefined ? refused(404, 'Not Found') : { status: 200, body: { user } };
}

function routeSignedIn(state: FakeApiState, request: string, body: Record<string, string>): FakeResponse {
  if (request === 'GET /me') {
    return { status: 200, body: state.me };
  }
  if (request === 'POST /operators') {
    return createOperator(state, body['legalName'] ?? '');
  }
  return routeLots(state.me?.operator ?? null, request);
}

function routeLots(operator: DashboardOperator | null, request: string): FakeResponse {
  if (operator === null) {
    return request === 'GET /lots' ? refused(409, 'NO_OPERATOR') : refused(404, 'LOT_NOT_FOUND');
  }
  const lots = lotsByOperator.get(operator.id) ?? [];
  if (request === 'GET /lots') {
    return { status: 200, body: lots };
  }
  const lot = lots.find(({ id }) => request === `GET /lots/${id}`);
  return lot === undefined ? refused(404, 'LOT_NOT_FOUND') : { status: 200, body: lot };
}

function createOperator(state: FakeApiState, legalName: string): FakeResponse {
  if (state.me === null || state.me.operator !== null) {
    return refused(409, 'OPERATOR_EXISTS');
  }
  const operator: DashboardOperator = { id: '00000000-0000-4000-8000-000000000199', legalName: legalName.trim(), kycStatus: 'NOT_STARTED' };
  state.me = { user: state.me.user, operator };
  return { status: 201, body: operator };
}

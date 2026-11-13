import type { DashboardOperator } from '@palier/shared-types';
import { type FakeAnswer, type FakeApiState, type FakeResponse, meFor, refused, testUsers } from './fakeDashboardData.ts';
import { routeLots } from './fakeLotRoutes.ts';


export function routeRequest(state: FakeApiState, url: string, init: RequestInit = {}): FakeAnswer {
  const method = init.method ?? 'GET';
  const path = url.replace('/v1/dashboard', '');
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  state.requests.push(`${method} ${path}`);
  const answer = state.answers.get(`${method} ${path}`);
  if (answer !== undefined) {
    return answer;
  }
  if (path.startsWith('/test/')) {
    return routeTestRequest(state, path, body);
  }
  if (path === '/sign-out') {
    state.me = null;
    return { status: 204 };
  }
  return state.me === null ? refused(401, 'UNAUTHORIZED') : routeSignedIn(state, `${method} ${path}`, body);
}

function routeTestRequest(state: FakeApiState, path: string, body: Record<string, unknown>): FakeResponse {
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

function routeSignedIn(state: FakeApiState, request: string, body: Record<string, unknown>): FakeResponse {
  if (request === 'GET /me') {
    return { status: 200, body: state.me };
  }
  if (request === 'POST /operators') {
    return createOperator(state, String(body['legalName'] ?? ''));
  }
  if (request.startsWith('POST /operators/') && request.endsWith('/stripe-onboarding')) {
    return startStripeOnboarding(state.me?.operator ?? null, request);
  }
  return routeLots(state, request, body);
}

function createOperator(state: FakeApiState, legalName: string): FakeResponse {
  if (state.me === null || state.me.operator !== null) {
    return refused(409, 'OPERATOR_EXISTS');
  }
  const operator: DashboardOperator = { id: '00000000-0000-4000-8000-000000000199', legalName: legalName.trim(), kycStatus: 'NOT_STARTED' };
  state.me = { user: state.me.user, operator };
  return { status: 201, body: operator };
}

export const STRIPE_ONBOARDING_URL = 'https://connect.stripe.com/setup/e/acct_test/onboarding';

// Only a member's own operator answers; any other id is not found, as in the API.
function startStripeOnboarding(operator: DashboardOperator | null, request: string): FakeResponse {
  return request === `POST /operators/${operator?.id}/stripe-onboarding` ? { status: 200, body: { url: STRIPE_ONBOARDING_URL } } : refused(404, 'OPERATOR_NOT_FOUND');
}

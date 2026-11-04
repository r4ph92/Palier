import type { DashboardUser } from '@palier/shared-types';
import { vi } from 'vitest';
import { type FakeApiState, meFor } from './fakeDashboardData.ts';
import { routeRequest, type FakeResponse } from './fakeDashboardRoutes.ts';

export { julie, lavoie, nouvelOperateur, parkingDemo, pierre, sophie } from './fakeDashboardData.ts';

interface FakeApiOptions {
  readonly signedInAs?: DashboardUser;
  readonly testUsersListed?: boolean;
}

// Stands in for the API behind the Vite proxy: same paths, same status codes, same error bodies.
export function installFakeApi({ signedInAs, testUsersListed = true }: FakeApiOptions = {}): FakeApiState {
  const state: FakeApiState = { me: signedInAs === undefined ? null : meFor(signedInAs), testUsersListed, requests: [] };
  vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => Promise.resolve(toResponse(routeRequest(state, input, init)))));
  return state;
}

function toResponse({ status, body }: FakeResponse): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

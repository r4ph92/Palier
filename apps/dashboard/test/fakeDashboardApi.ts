import type { DashboardUser } from '@palier/shared-types';
import { vi } from 'vitest';
import { type FakeAnswer, type FakeApiState, meFor } from './fakeDashboardData.ts';
import { routeRequest } from './fakeDashboardRoutes.ts';

export { julie, lavoie, nouvelOperateur, parkingDemo, pierre, sophie } from './fakeDashboardData.ts';

interface FakeApiOptions {
  readonly signedInAs?: DashboardUser;
  readonly testUsersListed?: boolean;
  readonly answers?: Readonly<Record<string, FakeAnswer>>;
}

// Stands in for the API behind the Vite proxy: same paths, same status codes, same error bodies.
export function installFakeApi({ signedInAs, testUsersListed = true, answers = {} }: FakeApiOptions = {}): FakeApiState {
  const me = signedInAs === undefined ? null : meFor(signedInAs);
  const state: FakeApiState = { me, testUsersListed, requests: [], answers: new Map(Object.entries(answers)) };
  vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => toResponse(routeRequest(state, input, init))));
  return state;
}

function toResponse(answer: FakeAnswer): Promise<Response> {
  if (answer === 'pending') {
    return new Promise(() => undefined);
  }
  const body = answer.body === undefined ? null : JSON.stringify(answer.body);
  return Promise.resolve(new Response(body, { status: answer.status, headers: { 'content-type': 'application/json' } }));
}

import type { DashboardUser } from '@palier/shared-types';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { type FakeAnswer, type FakeApiState, meFor, seededLots } from './fakeDashboardData.ts';
import { routeRequest } from './fakeDashboardRoutes.ts';

export { garageRoy, julie, lavoie, nouvelOperateur, parkingDemo, pierre, sophie } from './fakeDashboardData.ts';

interface FakeApiOptions {
  readonly signedInAs?: DashboardUser;
  readonly testUsersListed?: boolean;
  readonly answers?: Readonly<Record<string, FakeAnswer>>;
}

// Stands in for the API behind the Vite proxy: same paths, same status codes, same error bodies.
export function installFakeApi({ signedInAs, testUsersListed = true, answers = {} }: FakeApiOptions = {}): FakeApiState {
  const me = signedInAs === undefined ? null : meFor(signedInAs);
  const state: FakeApiState = { me, testUsersListed, requests: [], answers: new Map(Object.entries(answers)), answered: [], lots: seededLots() };
  vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => toResponse(state, routeRequest(state, input, init))));
  return state;
}

export async function allAnswersReceived(api: FakeApiState): Promise<void> {
  await act(async () => {
    await Promise.all(api.answered);
  });
}

function toResponse(state: FakeApiState, answer: FakeAnswer): Promise<Response> {
  if (answer === 'pending') {
    return new Promise(() => undefined);
  }
  const body = answer.body === undefined ? null : JSON.stringify(answer.body);
  const response = Promise.resolve(new Response(body, { status: answer.status, headers: { 'content-type': 'application/json' } }));
  state.answered.push(response);
  return response;
}

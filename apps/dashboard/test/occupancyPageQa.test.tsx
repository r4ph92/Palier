import type { DashboardLotOccupancy } from '@palier/shared-types';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, parkingDemo, parkingDemoOccupancy, sophie } from './fakeDashboardApi.ts';
import { lineOf } from './lineOf.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const OCCUPANCY_PATH = `/lots/${parkingDemo.id}/occupancy`;
const OCCUPANCY_REQUEST = `GET /lots/${parkingDemo.id}/occupancy`;
const STALE_NOTE = 'Données non mises à jour. Nouvel essai dans un instant.';

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function occupancyRequestCount(requests: readonly string[]): number {
  return requests.filter((request) => request === OCCUPANCY_REQUEST).length;
}

// After the first answer, every occupancy request hangs until its signal aborts, like an API that stopped answering.
function hangOccupancyPollsAfterFirstLoad() {
  const fakeFetch = globalThis.fetch;
  let occupancyCalls = 0;
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    if (!input.endsWith('/occupancy') || occupancyCalls++ === 0) {
      return fakeFetch(input, init);
    }
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')));
    });
  });
}

describe('the occupancy page under attack', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags the figures as not updated when polls hang for a minute without an answer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const api = installFakeApi({ signedInAs: sophie });
    hangOccupancyPollsAfterFirstLoad();
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, vehicleCount: 9, counterGap: { kind: 'SPOTS_TO_CHECK', spots: 4 } });

    await advance(2 * POLL_MILLISECONDS);

    expect(screen.getByText(lineOf('Écart : 2 places à vérifier'))).toBeDefined();
    expect(screen.getByText(STALE_NOTE)).toBeDefined();
  });

  it('shows not found and stops polling when a poll answers LOT_NOT_FOUND after a first load', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    api.answers.set(OCCUPANCY_REQUEST, { status: 404, body: { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' } });

    await advance(POLL_MILLISECONDS);

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Véhicules comptés/)).toBeNull();
    await advance(2 * POLL_MILLISECONDS);
    expect(occupancyRequestCount(api.requests)).toBe(2);
  });

  it('names each level section after its level, a code with a space included', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const basement: DashboardLotOccupancy['levels'][number] = { code: 'Sous-sol 1', counts: { AVAILABLE: 2, HELD: 0, ASSIGNED: 0, OCCUPIED: 0, OCCUPIED_UNKNOWN: 0, OUT_OF_SERVICE: 0 } };
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, levels: [basement, ...parkingDemoOccupancy.levels] });
    renderDashboard({ path: OCCUPANCY_PATH });

    await screen.findByText(lineOf('Écart : 2 places à vérifier'));

    expect(screen.getByRole('columnheader', { name: 'Sous-sol 1' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'P1' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Places par niveau' })).toBeDefined();
  });

  it('shows a level code with markup as text, never as markup', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const hostile = '<img src=x onerror=alert(1)>';
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, levels: parkingDemoOccupancy.levels.map((level) => ({ ...level, code: hostile })) });
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByRole('columnheader', { name: hostile })).toBeDefined();
    expect(document.querySelector('main img')).toBeNull();
  });

  it('sends the operator to sign-in when a poll meets an ended session, and polls no more', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    api.me = null;

    await advance(POLL_MILLISECONDS);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    await advance(2 * POLL_MILLISECONDS);
    expect(occupancyRequestCount(api.requests)).toBe(2);
  });

  it('stops polling once the operator follows the back link to the lot', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));

    await userEvent.click(screen.getByRole('link', { name: 'Retour au stationnement' }));
    await screen.findByRole('heading', { level: 1, name: 'Parking Démo' });
    await advance(3 * POLL_MILLISECONDS);

    expect(occupancyRequestCount(api.requests)).toBe(1);
  });

  it('words the counter below the places taken and the stale note in English', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, vehicleCount: 3, counterGap: { kind: 'COUNTER_BELOW', spots: 2 } });
    renderDashboard({ path: OCCUPANCY_PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));
    api.answers.set(OCCUPANCY_REQUEST, { status: 500 });

    await advance(POLL_MILLISECONDS);

    expect(await screen.findByText('Figures not updated. Trying again shortly.')).toBeDefined();
    expect(screen.getByText(lineOf('Counter below occupied spots: 2'))).toBeDefined();
    expect(screen.getByText(lineOf('Vehicles counted: 3'))).toBeDefined();
  });
});

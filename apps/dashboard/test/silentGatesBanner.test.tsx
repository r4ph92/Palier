import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, parkingDemo, parkingDemoOccupancy, sophie } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { lineOf } from './lineOf.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const OCCUPANCY_PATH = `/lots/${parkingDemo.id}/occupancy`;

function silentGatesRegion(): HTMLElement {
  const region = document.querySelector('.silent-gates');
  if (!(region instanceof HTMLElement)) {
    throw new Error('The silent gates region is not on the page');
  }
  return region;
}

async function advanceOnePoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
  });
}

describe('the silent gates banner of the occupancy page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays an empty live region while every gate answers', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByRole('heading', { level: 1, name: 'Occupation — Parking Démo' });

    expect(silentGatesRegion().getAttribute('role')).toBe('status');
    expect(silentGatesRegion().textContent).toBe('');
  });

  it('names the gate that fell silent at the next poll, in red, with a link to the equipment', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByRole('heading', { level: 1, name: 'Occupation — Parking Démo' });
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, silentGateNames: ['Entrée Démo'] });

    await advanceOnePoll();

    expect(await screen.findByText(lineOf('Borne muette : Entrée Démo Voir l’équipement'))).toBeDefined();
    expect(silentGatesRegion().querySelector('.state-mark-danger')).not.toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Voir l’équipement' }));
    expect(window.location.pathname).toBe(`/lots/${parkingDemo.id}/equipment`);
  });

  it('uses the plural for two silent gates', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, silentGateNames: ['Entrée Démo', 'Sortie Démo'] });
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByText(lineOf('Bornes muettes : Entrée Démo, Sortie Démo Voir l’équipement'))).toBeDefined();
  });

  it('reads Silent terminals in English, with no French left', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, silentGateNames: ['Entrée Démo', 'Sortie Démo'] });
    renderDashboard({ path: OCCUPANCY_PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByText(lineOf('Silent terminals: Entrée Démo, Sortie Démo See equipment'))).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('empties again once the gate answers', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, { ...parkingDemoOccupancy, silentGateNames: ['Entrée Démo'] });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Borne muette : Entrée Démo Voir l’équipement'));
    api.occupancy.set(parkingDemo.id, parkingDemoOccupancy);

    await advanceOnePoll();

    await vi.waitFor(() => expect(silentGatesRegion().textContent).toBe(''));
  });
});

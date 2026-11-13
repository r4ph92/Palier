import type { DashboardLotOccupancy } from '@palier/shared-types';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, parkingDemoOccupancy, pierre, sophie } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const OCCUPANCY_PATH = `/lots/${parkingDemo.id}/occupancy`;
const OCCUPANCY_REQUEST = `GET /lots/${parkingDemo.id}/occupancy`;

function withGap(counterGap: DashboardLotOccupancy['counterGap'], vehicleCount: number): DashboardLotOccupancy {
  return { ...parkingDemoOccupancy, vehicleCount, counterGap };
}

function factOf(label: string): string | null {
  const term = [...document.querySelectorAll('dt')].find((candidate) => candidate.textContent === label);
  return term?.nextElementSibling?.textContent ?? null;
}

async function advanceOnePoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
  });
}

describe('the occupancy page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the P1 counts per state, the counter, the places taken and the gap of Parking Démo', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Occupation — Parking Démo' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Niveau P1' })).toBeDefined();
    expect(['Libre', 'Garantie', 'Attribuée', 'Occupée', 'Occupée, inconnue', 'Hors service'].map(factOf)).toEqual(['3', '1', '1', '3', '1', '1']);
    expect(screen.getByText('Véhicules comptés : 7')).toBeDefined();
    expect(screen.getByText('Places occupées ou attribuées : 5')).toBeDefined();
    expect(screen.getByText('Écart : 2 places à vérifier')).toBeDefined();
  });

  it('opens from the lot page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Occupation' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Occupation — Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(OCCUPANCY_PATH);
  });

  it('shows new figures within 30 seconds without a reload or a loading state', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText('Écart : 2 places à vérifier');
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots: 1 }, 6));

    await advanceOnePoll();

    expect(await screen.findByText('Écart : 1 place à vérifier')).toBeDefined();
    expect(screen.getByText('Véhicules comptés : 6')).toBeDefined();
    expect(screen.queryByText('Chargement…')).toBeNull();
    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(2);
  });

  it('stops polling once the page is closed', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const page = renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText('Écart : 2 places à vérifier');

    page.unmount();
    await advanceOnePoll();

    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(1);
  });

  it('keeps the last figures with a discreet note when a poll fails, and clears it once a poll succeeds', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText('Écart : 2 places à vérifier');
    api.answers.set(OCCUPANCY_REQUEST, { status: 500 });

    await advanceOnePoll();

    const note = await screen.findByText('Données non mises à jour. Nouvel essai dans un instant.');
    expect(note.getAttribute('role')).toBe('status');
    expect(screen.getByText('Écart : 2 places à vérifier')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    api.answers.delete(OCCUPANCY_REQUEST);
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots: 0 }, 5));

    await advanceOnePoll();

    expect(await screen.findByText('Écart : 0 place à vérifier')).toBeDefined();
    expect(screen.queryByText(/Données non mises à jour/)).toBeNull();
  });

  it('flags a counter below the occupied places', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'COUNTER_BELOW', spots: 2 }, 3));
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByText('Compteur inférieur aux places occupées : 2')).toBeDefined();
    expect(screen.queryByText(/Écart/)).toBeNull();
  });

  it.each([
    [0, 'Écart : 0 place à vérifier'],
    [1, 'Écart : 1 place à vérifier'],
    [2, 'Écart : 2 places à vérifier'],
  ])('words a gap of %i in French', async (spots, sentence) => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots }, 5 + spots));
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByText(sentence)).toBeDefined();
  });

  it.each([
    [0, 'Gap: 0 spots to check'],
    [1, 'Gap: 1 spot to check'],
    [2, 'Gap: 2 spots to check'],
  ])('words a gap of %i in English, with no French left on the page', async (spots, sentence) => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots }, 5 + spots));
    renderDashboard({ path: OCCUPANCY_PATH });

    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByText(sentence)).toBeDefined();
    expect(screen.getByText('Vehicles counted: ' + String(5 + spots))).toBeDefined();
    expect(screen.getByText('Spots occupied or assigned: 5')).toBeDefined();
    expect(factOf('Out of service')).toBe('1');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('gives Pierre not found and nothing about Parking Démo', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Parking Démo/)).toBeNull();
    expect(screen.queryByText(/Véhicules comptés/)).toBeNull();
  });

  it('says a lot with no level has none', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}/occupancy` });

    expect(await screen.findByText('Aucun niveau.')).toBeDefined();
    expect(screen.getByText('Écart : 0 place à vérifier')).toBeDefined();
  });

  it('shows an error with a retry when the first load fails, then the figures once it succeeds', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [OCCUPANCY_REQUEST]: { status: 500 } } });
    renderDashboard({ path: OCCUPANCY_PATH });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(screen.queryByText(/Données non mises à jour/)).toBeNull();
    expect(within(screen.getByRole('link', { name: 'Retour au stationnement' }).parentElement as HTMLElement).getByRole('button', { name: 'Réessayer' })).toBeDefined();
    api.answers.delete(OCCUPANCY_REQUEST);

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Écart : 2 places à vérifier')).toBeDefined();
  });
});

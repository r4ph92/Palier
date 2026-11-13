import type { DashboardLotOccupancy } from '@palier/shared-types';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, parkingDemoOccupancy, pierre, sophie } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { lineOf } from './lineOf.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const OCCUPANCY_PATH = `/lots/${parkingDemo.id}/occupancy`;
const OCCUPANCY_REQUEST = `GET /lots/${parkingDemo.id}/occupancy`;

function withGap(counterGap: DashboardLotOccupancy['counterGap'], vehicleCount: number): DashboardLotOccupancy {
  return { ...parkingDemoOccupancy, vehicleCount, counterGap };
}

function countOf(state: string, level = 'P1'): string | null {
  const columns = [...document.querySelectorAll('thead th')].map((header) => header.textContent);
  const row = [...document.querySelectorAll('tbody tr')].find((candidate) => candidate.querySelector('th')?.textContent === state);
  return row?.querySelectorAll('td')[columns.indexOf(level) - 1]?.textContent ?? null;
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
    expect(screen.getByRole('table', { name: 'Places par état et par niveau' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'P1' })).toBeDefined();
    expect(['Libre', 'Garantie', 'Attribuée', 'Occupée', 'Occupée, inconnue', 'Hors service'].map((state) => countOf(state))).toEqual(['3', '1', '1', '3', '1', '1']);
    expect(screen.getByText(lineOf('Véhicules comptés : 7'))).toBeDefined();
    expect(screen.getByText(lineOf('Places occupées ou attribuées : 5'))).toBeDefined();
    expect(screen.getByText(lineOf('Écart : 2 places à vérifier'))).toBeDefined();
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
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots: 1 }, 6));

    await advanceOnePoll();

    expect(await screen.findByText(lineOf('Écart : 1 place à vérifier'))).toBeDefined();
    expect(screen.getByText(lineOf('Véhicules comptés : 6'))).toBeDefined();
    expect(screen.queryByText('Chargement…')).toBeNull();
    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(2);
  });

  it('stops polling once the page is closed', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const page = renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));

    page.unmount();
    await advanceOnePoll();

    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(1);
  });

  it('keeps the last figures with a discreet note when a poll fails, and clears it once a poll succeeds', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    const statusRegion = document.querySelector<HTMLElement>('.stale-note') as HTMLElement;
    expect(statusRegion.getAttribute('role')).toBe('status');
    expect(statusRegion.textContent).toBe('');
    api.answers.set(OCCUPANCY_REQUEST, { status: 500 });

    await advanceOnePoll();

    const note = await screen.findByText('Données non mises à jour. Nouvel essai dans un instant.');
    expect(note.closest('[role="status"]')).toBe(statusRegion);
    expect(statusRegion.textContent).toMatch(/Dernière mise à jour\s: \d{1,2} h \d{2}/);
    expect(screen.getByText(lineOf('Écart : 2 places à vérifier'))).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    api.answers.delete(OCCUPANCY_REQUEST);
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'SPOTS_TO_CHECK', spots: 0 }, 5));

    await advanceOnePoll();

    expect(await screen.findByText(lineOf('Écart : 0 place à vérifier'))).toBeDefined();
    expect(screen.queryByText(/Données non mises à jour/)).toBeNull();
    expect(document.querySelector('.stale-note')).toBe(statusRegion);
    expect(statusRegion.textContent).toBe('');
  });

  it('flags a counter below the occupied places', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.occupancy.set(parkingDemo.id, withGap({ kind: 'COUNTER_BELOW', spots: 2 }, 3));
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByText(lineOf('Compteur inférieur aux places occupées : 2'))).toBeDefined();
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

    expect(await screen.findByText(lineOf(sentence))).toBeDefined();
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

    expect(await screen.findByText(lineOf(sentence))).toBeDefined();
    expect(screen.getByText(lineOf('Vehicles counted: ' + String(5 + spots)))).toBeDefined();
    expect(screen.getByText(lineOf('Spots occupied or assigned: 5'))).toBeDefined();
    expect(countOf('Out of service')).toBe('1');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('gives Pierre not found and nothing about Parking Démo', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Parking Démo/)).toBeNull();
    expect(screen.queryByText(/Véhicules comptés/)).toBeNull();
  });

  it('says why a lot with no level has none and gives no gap to check', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}/occupancy` });

    expect(await screen.findByText(/^Aucun niveau\. Les niveaux, les allées et les places sont créés avec le plan du stationnement/)).toBeDefined();
    expect(screen.getByText('Aucune place enregistrée : l’écart ne peut pas être calculé.')).toBeDefined();
    expect(screen.queryByText(/Écart/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the page header with a loading status and no figures while the first load runs', async () => {
    installFakeApi({ signedInAs: sophie });
    const answerOthers = globalThis.fetch;
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => (input.endsWith('/occupancy') ? new Promise<Response>(() => undefined) : answerOthers(input, init)));
    renderDashboard({ path: OCCUPANCY_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Occupation' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Chargement…');
    expect(screen.queryByText(/Véhicules comptés/)).toBeNull();
  });

  it('skips the ticks while the tab is hidden and reloads when it shows again', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: OCCUPANCY_PATH });
    await screen.findByText(lineOf('Écart : 2 places à vérifier'));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    await advanceOnePoll();
    await advanceOnePoll();
    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(1);
    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(api.requests.filter((request) => request === OCCUPANCY_REQUEST)).toHaveLength(2);
    hidden.mockRestore();
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

    expect(await screen.findByText(lineOf('Écart : 2 places à vérifier'))).toBeDefined();
  });
});

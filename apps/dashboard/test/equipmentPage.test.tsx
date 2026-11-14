import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { entreeDemo, equipmentOf, silent, sortieDemo } from './fakeEquipmentData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const EQUIPMENT_PATH = `/lots/${parkingDemo.id}/equipment`;
const EQUIPMENT_REQUEST = `GET /lots/${parkingDemo.id}/equipment`;
const WHITESPACE = /\s+/g;
const YESTERDAY_AT_TWO_FIVE = new Date(2026, 10, 12, 14, 5);

// French and English times hold narrow no-break spaces ("14 h 05", "2:05 PM"); the test compares plain spaces.
function stateOf(gateName: string): string {
  const row = screen.getByRole('rowheader', { name: gateName }).closest('tr') as HTMLElement;
  return (within(row).getAllByRole('cell').at(-1)?.textContent ?? '').replace(WHITESPACE, ' ').trim();
}

function toneOf(gateName: string): string | undefined {
  const row = screen.getByRole('rowheader', { name: gateName }).closest('tr') as HTMLElement;
  return [...(row.querySelector('.state-mark-square')?.classList ?? [])].find((name) => name !== 'state-mark-square');
}

async function advanceOnePoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
  });
}

describe('the equipment page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens from the lot page and shows each gate with its direction and state', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Équipement' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Équipement — Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(EQUIPMENT_PATH);
    expect(stateOf('Entrée Démo')).toBe('En ligne');
    expect(toneOf('Entrée Démo')).toBe('state-mark-free');
    expect(stateOf('Sortie Démo')).toBe('Aucun signal reçu');
    expect(toneOf('Sortie Démo')).toBe('state-mark-muted');
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toContain('Sortie');
    expect(screen.getByText(/^Une borne sans signal depuis plus de 2 minutes est muette\./)).toBeDefined();
  });

  it('shows a gate fallen silent within one poll, in red with the time of its last signal', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });
    api.equipment.set(parkingDemo.id, equipmentOf([silent(entreeDemo), sortieDemo]));

    await advanceOnePoll();

    await vi.waitFor(() => expect(stateOf('Entrée Démo')).toBe('Muette depuis 14 h 05'));
    expect(toneOf('Entrée Démo')).toBe('state-mark-danger');
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('adds the date when the last signal is from another day than the server’s today', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([silent(entreeDemo, YESTERDAY_AT_TWO_FIVE), sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });

    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    expect(stateOf('Entrée Démo')).toBe('Muette depuis le 12 novembre, 14 h 05');
  });

  it('judges today by the server’s instant, not by the computer’s clock', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([silent(entreeDemo, YESTERDAY_AT_TWO_FIVE), sortieDemo], new Date(2026, 10, 12, 23, 0)));
    renderDashboard({ path: EQUIPMENT_PATH });

    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    expect(stateOf('Entrée Démo')).toBe('Muette depuis 14 h 05');
  });

  it('reads Online, Silent since 2:05 PM and No signal received in English, with no French left', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: EQUIPMENT_PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Equipment — Parking Démo' })).toBeDefined();
    expect(stateOf('Entrée Démo')).toBe('Online');
    expect(stateOf('Sortie Démo')).toBe('No signal received');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
    api.equipment.set(parkingDemo.id, equipmentOf([silent(entreeDemo), silent(sortieDemo, YESTERDAY_AT_TWO_FIVE)]));
    await advanceOnePoll();
    await vi.waitFor(() => expect(stateOf('Entrée Démo')).toBe('Silent since 2:05 PM'));
    expect(stateOf('Sortie Démo')).toBe('Silent since Nov 12, 2:05 PM');
  });

  it('gives Pierre not found on Parking Démo and nothing about its gates', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: EQUIPMENT_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText('Entrée Démo')).toBeNull();
    expect(api.requests.filter((request) => request === EQUIPMENT_REQUEST)).toHaveLength(1);
  });

  it('says so when a lot has no gate yet', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}/equipment` });

    expect(await screen.findByText('Aucune borne n’est installée dans ce stationnement.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('points to the map for the beacon batteries', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: EQUIPMENT_PATH });

    await userEvent.click(await screen.findByRole('link', { name: 'Plan et balises' }));

    expect(window.location.pathname).toBe(`/lots/${parkingDemo.id}/map`);
  });

  it('shows an error with a retry when the first load fails, then the gates once it succeeds', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [EQUIPMENT_REQUEST]: { status: 500 } } });
    renderDashboard({ path: EQUIPMENT_PATH });

    expect(await screen.findByRole('heading', { level: 1, name: 'Équipement indisponible' })).toBeDefined();
    api.answers.delete(EQUIPMENT_REQUEST);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('rowheader', { name: 'Entrée Démo' })).toBeDefined();
  });

  it('keeps the last states with the stale note when a poll fails', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });
    api.answers.set(EQUIPMENT_REQUEST, { status: 500 });

    await advanceOnePoll();

    expect(await screen.findByText('Données non mises à jour. Nouvel essai dans un instant.')).toBeDefined();
    expect(stateOf('Entrée Démo')).toBe('En ligne');
  });
});

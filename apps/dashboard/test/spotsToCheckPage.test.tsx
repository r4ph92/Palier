import type { DashboardSpotToCheck } from '@palier/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { PARKING_DEMO_A1_ID, PARKING_DEMO_B2_ID, seededSpotsToCheck } from './fakeSpotData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/spots-to-check`;
const rowOf = (number: string): HTMLElement => screen.getByRole('rowheader', { name: number }).closest('tr') as HTMLElement;

function seededFlags(): [DashboardSpotToCheck, DashboardSpotToCheck] {
  const [aisleA, aisleB] = seededSpotsToCheck().get(parkingDemo.id) ?? [];
  if (aisleA === undefined || aisleB === undefined) {
    throw new Error('The seeded Parking Démo has two flagged spots.');
  }
  return [aisleA, aisleB];
}

async function openSpotsToCheck(path = PAGE) {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path });
  await screen.findByRole('table');
  return api;
}

describe('the spots to check page', () => {
  it('lists A-1 and B-2 with their place, time and reason', async () => {
    await openSpotsToCheck();

    expect(within(rowOf('A-1')).getByText('P1 · allée A')).toBeDefined();
    expect(within(rowOf('A-1')).getByText('allée différente')).toBeDefined();
    expect(within(rowOf('B-2')).getByText('place signalée prise')).toBeDefined();
    expect(within(rowOf('A-1')).getByText(/nov/)).toBeDefined();
    expect(rowOf('A-1').querySelector('time')?.getAttribute('datetime')).toBe('2026-11-13T14:05:00.000Z');
  });

  it('says the reason was not recorded for a flag from before reasons were kept', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spotsToCheck.set(parkingDemo.id, [{ spotId: PARKING_DEMO_A1_ID, number: 'A-1', levelCode: 'P1', aisleCode: 'A', since: '2026-11-13T14:05:00.000Z', reason: null, state: 'AVAILABLE', clearable: true, heldBySession: false }]);
    renderDashboard({ path: PAGE });

    expect(await screen.findByText('raison non enregistrée')).toBeDefined();
  });

  it('removes a free spot after Vérifiée, says so, and keeps the others', async () => {
    const api = await openSpotsToCheck();

    await userEvent.click(screen.getByRole('button', { name: 'Place B-2 vérifiée' }));

    expect(await screen.findByText('Place B-2 vérifiée.')).toBeDefined();
    expect(screen.queryByRole('rowheader', { name: 'B-2' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'A-1' })).toBeDefined();
    expect(api.requests).toContain(`POST /lots/${parkingDemo.id}/spots/${PARKING_DEMO_B2_ID}/check-cleared`);
  });

  it('shows the empty state once the last flag is cleared', async () => {
    const api = await openSpotsToCheck();
    api.spotsToCheck.set(parkingDemo.id, (api.spotsToCheck.get(parkingDemo.id) ?? []).slice(1));
    await userEvent.click(screen.getByRole('button', { name: 'Place B-2 vérifiée' }));

    expect(await screen.findByText('Aucune place à vérifier.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps a still-assigned spot in the list and says why, beside its row', async () => {
    const api = await openSpotsToCheck();

    await userEvent.click(screen.getByRole('button', { name: 'Place A-1 vérifiée' }));

    const alert = await within(rowOf('A-1')).findByRole('alert');
    expect(alert.textContent).toBe('Place encore attribuée à une session — attendez la sortie.');
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole('button', { name: 'Place A-1 vérifiée' }).getAttribute('aria-describedby')).toBe(alert.id);
    expect(screen.getByRole('rowheader', { name: 'A-1' })).toBeDefined();
    expect(api.spotsToCheck.get(parkingDemo.id)).toHaveLength(2);
  });

  it('shows the busy lot message and keeps the row when the lot is busy', async () => {
    const busy = { status: 503, body: { error: 'LOT_BUSY' } };
    installFakeApi({ signedInAs: sophie, answers: { [`POST /lots/${parkingDemo.id}/spots/${PARKING_DEMO_B2_ID}/check-cleared`]: busy } });
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place B-2 vérifiée' }));

    expect((await within(rowOf('B-2')).findByRole('alert')).textContent).toBe('Le stationnement est occupé par une autre opération. Réessayez dans quelques secondes.');
  });

  it('shows the lot as not found for an operator who does not own it, with nothing listed', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText('A-1')).toBeNull();
  });

  it('shows a failed load as unavailable with a retry, then the list', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [`GET /lots/${parkingDemo.id}/spots-to-check`]: { status: 500 } } });
    renderDashboard({ path: PAGE });
    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    api.answers.delete(`GET /lots/${parkingDemo.id}/spots-to-check`);

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('rowheader', { name: 'A-1' })).toBeDefined();
  });

  it('is linked from the lot page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Places à vérifier' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Places à vérifier — Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(PAGE);
  });

  it('reads Spots to check, with every label in English', async () => {
    await openSpotsToCheck();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Spots to check — Parking Démo' })).toBeDefined();
    expect(screen.getByText('different aisle')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Spot B-2 checked' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
    await waitFor(() => expect(document.title).toBe('Spots to check — Parking Démo · Palier dashboard'));
  });

  it('names the lot in the title and counts the flagged spots', async () => {
    await openSpotsToCheck();

    expect(screen.getByRole('heading', { level: 1, name: 'Places à vérifier — Parking Démo' })).toBeDefined();
    expect(screen.getByRole('table', { name: '2 places à vérifier' })).toBeDefined();
  });

  it('shows the state of each spot, a free spot an active session holds not reading as free', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const [occupied, free] = seededFlags();
    api.spotsToCheck.set(parkingDemo.id, [{ ...occupied, state: 'AVAILABLE', clearable: false, heldBySession: true }, { ...free, state: 'AVAILABLE', clearable: true }]);
    renderDashboard({ path: PAGE });
    await screen.findByRole('table');

    expect(within(rowOf('A-1')).getByText('Retenue par une session')).toBeDefined();
    expect(within(rowOf('B-2')).getByText('Libre')).toBeDefined();
  });

  it('keeps the label Vérifiée on the button while the spot is being cleared', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.answers.set(`POST /lots/${parkingDemo.id}/spots/${PARKING_DEMO_B2_ID}/check-cleared`, 'pending');
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place B-2 vérifiée' }));

    expect(rowOf('B-2').getAttribute('aria-busy')).toBe('true');
    expect(within(rowOf('B-2')).getByRole('button').textContent).toBe('Vérifiée');
  });

  it('puts focus on the status line when the last flagged spot is cleared', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spotsToCheck.set(parkingDemo.id, (api.spotsToCheck.get(parkingDemo.id) ?? []).slice(1));
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place B-2 vérifiée' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')));
  });

  it('puts focus on the following spot’s button after a clear', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const [first, second] = seededFlags();
    api.spotsToCheck.set(parkingDemo.id, [{ ...first, clearable: true, state: 'AVAILABLE' }, { ...second, clearable: true }]);
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place A-1 vérifiée' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Place B-2 vérifiée' })));
  });

  it('reads the list again when a clear answers that the spot is gone, and says so above the list with focus on it', async () => {
    const clearRequest = `POST /lots/${parkingDemo.id}/spots/${PARKING_DEMO_B2_ID}/check-cleared`;
    const api = installFakeApi({ signedInAs: sophie, answers: { [clearRequest]: { status: 404, body: { error: 'SPOT_NOT_FOUND' } } } });
    renderDashboard({ path: PAGE });
    const button = await screen.findByRole('button', { name: 'Place B-2 vérifiée' });
    api.spotsToCheck.set(parkingDemo.id, (api.spotsToCheck.get(parkingDemo.id) ?? []).filter(({ spotId }) => spotId !== PARKING_DEMO_B2_ID));
    await userEvent.click(button);

    const refusal = await screen.findByRole('alert');
    expect(refusal.textContent).toBe('Cette place est introuvable. La liste des places a été rechargée.');
    expect(screen.queryByRole('rowheader', { name: 'B-2' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(refusal));
    expect(api.requests.filter((request) => request === `GET /lots/${parkingDemo.id}/spots-to-check`)).toHaveLength(2);
  });

  it('forgets a row refusal when the page turns', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const [template] = seededFlags();
    const many = Array.from({ length: 51 }, (_, index) => ({ ...template, spotId: `spot-${index}`, number: `C-${index + 1}`, clearable: index !== 0 }));
    api.spotsToCheck.set(parkingDemo.id, many);
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place C-1 vérifiée' }));
    await screen.findByRole('alert');

    const pagesBelow = screen.getByRole('navigation', { name: 'Pages de la liste des places, sous le tableau' });
    await userEvent.click(within(pagesBelow).getByRole('button', { name: 'Suivantes' }));
    await userEvent.click(within(pagesBelow).getByRole('button', { name: 'Précédentes' }));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows 50 spots at a time, with the pager, when many are flagged', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const [template] = seededFlags();
    const many = Array.from({ length: 64 }, (_, index) => ({ ...template, spotId: `spot-${index}`, number: `C-${index + 1}`, clearable: true }));
    api.spotsToCheck.set(parkingDemo.id, many);
    renderDashboard({ path: PAGE });

    await screen.findByRole('table', { name: '64 places à vérifier' });

    expect(screen.getAllByRole('rowheader')).toHaveLength(50);
    expect(screen.getByText('1–50 sur 64')).toBeDefined();
    const pagesBelow = screen.getByRole('navigation', { name: 'Pages de la liste des places, sous le tableau' });
    await userEvent.click(within(pagesBelow).getByRole('button', { name: 'Suivantes' }));
    expect(screen.getAllByRole('rowheader')).toHaveLength(14);
  });

  it('says when a spot appears in the list, in the empty state', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spotsToCheck.set(parkingDemo.id, []);
    renderDashboard({ path: PAGE });

    expect(await screen.findByText('Aucune place à vérifier.')).toBeDefined();
    expect(screen.getByText(/Une place apparaît ici/)).toBeDefined();
  });
});

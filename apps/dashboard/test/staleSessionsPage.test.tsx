import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { JULIE_STALE_SESSION_ID, MARC_STALE_SESSION_ID } from './fakeStaleSessionData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/stale-sessions`;
const PRESENCE_REQUEST = (sessionId: string) => `POST /lots/${parkingDemo.id}/stale-sessions/${sessionId}/presence`;
const rowOf = (plate: string): HTMLElement => screen.getByRole('link', { name: plate }).closest('tr') as HTMLElement;
const presentButton = (plate: string) => screen.getByRole('button', { name: `Véhicule présent, ${plate}` });

async function openStaleSessions(path = PAGE) {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path });
  await screen.findByRole('table');
  return api;
}

describe('the sessions with no exit page', () => {
  it('lists each flagged vehicle with its spot, last proof and flag time, in French', async () => {
    await openStaleSessions();

    expect(screen.getByRole('heading', { level: 1, name: 'Sessions sans sortie — Parking Démo' })).toBeDefined();
    expect(screen.getByText('2 sessions sans sortie')).toBeDefined();
    expect(within(rowOf('JTR 482')).getByText('A-1')).toBeDefined();
    expect(within(rowOf('JTR 482')).getByText(/P1 · allée.A/)).toBeDefined();
    expect(within(rowOf('JTR 482')).getByText(/Entrée confirmée/)).toBeDefined();
    expect(within(rowOf('MGA 913')).getByText(/Présence confirmée/)).toBeDefined();
    expect(rowOf('JTR 482').querySelectorAll('time')).toHaveLength(2);
    expect(rowOf('JTR 482').querySelectorAll('time')[1]?.getAttribute('datetime')).toBe('2026-11-08T09:00:00.000Z');
  });

  it('links each plate to the session page', async () => {
    await openStaleSessions();

    expect(screen.getByRole('link', { name: 'JTR 482' }).getAttribute('href')).toBe(`/lots/${parkingDemo.id}/sessions/${JULIE_STALE_SESSION_ID}`);
  });

  it('is reachable from the lot page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    const link = await screen.findByRole('link', { name: 'Sessions sans sortie' });

    expect(link.getAttribute('href')).toBe(PAGE);
  });

  it('AC3: takes the vehicle off the list after Véhicule présent, says so and keeps the other one', async () => {
    const api = await openStaleSessions();

    await userEvent.click(presentButton('JTR 482'));

    expect(await screen.findByText('Présence du véhicule JTR 482 confirmée. La session reste ouverte.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'JTR 482' })).toBeNull();
    expect(screen.getByRole('link', { name: 'MGA 913' })).toBeDefined();
    expect(api.requests).toContain(PRESENCE_REQUEST(JULIE_STALE_SESSION_ID));
  });

  it('moves focus to the next row button after a confirmation', async () => {
    await openStaleSessions();

    await userEvent.click(presentButton('JTR 482'));
    await screen.findByText(/Présence du véhicule JTR 482 confirmée/);

    expect(document.activeElement).toBe(presentButton('MGA 913'));
  });

  it('shows the empty state and focuses the status line once the last vehicle is confirmed', async () => {
    const api = await openStaleSessions();
    api.staleSessions.set(parkingDemo.id, (api.staleSessions.get(parkingDemo.id) ?? []).slice(0, 1));

    await userEvent.click(presentButton('JTR 482'));

    expect(await screen.findByText('Aucune session sans sortie.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.activeElement?.getAttribute('role')).toBe('status');
  });

  it('shows the empty state when nothing is flagged', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.staleSessions.set(parkingDemo.id, []);
    renderDashboard({ path: PAGE });

    expect(await screen.findByText('Aucune session sans sortie.')).toBeDefined();
  });

  it('reloads the list and names the vehicle when its session is no longer open', async () => {
    const api = await openStaleSessions();
    api.answers.set(PRESENCE_REQUEST(JULIE_STALE_SESSION_ID), { status: 404, body: { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' } });
    api.staleSessions.set(parkingDemo.id, (api.staleSessions.get(parkingDemo.id) ?? []).slice(1));

    await userEvent.click(presentButton('JTR 482'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('La session de JTR 482 n’est plus ouverte. La liste a été rechargée.');
    expect(screen.queryByRole('link', { name: 'JTR 482' })).toBeNull();
    expect(screen.getByRole('link', { name: 'MGA 913' })).toBeDefined();
  });

  it('keeps the row and says the lot is busy beside it, after reloading the list', async () => {
    const api = await openStaleSessions();
    api.answers.set(PRESENCE_REQUEST(JULIE_STALE_SESSION_ID), { status: 503, body: { statusCode: 503, error: 'LOT_BUSY', message: 'busy' } });

    await userEvent.click(presentButton('JTR 482'));

    const alert = await within(rowOf('JTR 482')).findByRole('alert');
    expect(alert.textContent).toBe('Le stationnement est occupé par une autre opération. Réessayez dans quelques secondes.');
    expect(presentButton('JTR 482').getAttribute('aria-describedby')).toBe(alert.id);
    expect(api.requests.filter((request) => request === `GET /lots/${parkingDemo.id}/stale-sessions`)).toHaveLength(2);
  });

  it('says the page could not be reloaded when the list read fails after a refusal', async () => {
    const api = await openStaleSessions();
    api.answers.set(PRESENCE_REQUEST(MARC_STALE_SESSION_ID), { status: 404, body: { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' } });
    api.answers.set(`GET /lots/${parkingDemo.id}/stale-sessions`, { status: 500, body: { statusCode: 500, error: 'Internal Server Error', message: 'x' } });

    await userEvent.click(presentButton('MGA 913'));

    const alert = await within(rowOf('MGA 913')).findByRole('alert');
    expect(alert.textContent).toBe('La page n’a pas pu être rechargée après ce refus. Rechargez la page avant de recommencer.');
  });

  it('AC4: reads as not found for the lot of another operator', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: PAGE });

    expect(await screen.findByText(/introuvable/i)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('offers a retry when the list cannot be read', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.answers.set(`GET /lots/${parkingDemo.id}/stale-sessions`, { status: 500, body: { statusCode: 500, error: 'Internal Server Error', message: 'x' } });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('button', { name: /Réessayer/ })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Retour au stationnement' })).toBeDefined();
  });

  it('shows the busy word and the status line while a confirmation runs', async () => {
    const api = await openStaleSessions();
    api.answers.set(PRESENCE_REQUEST(JULIE_STALE_SESSION_ID), 'pending');

    await userEvent.click(presentButton('JTR 482'));

    const busyWord = within(rowOf('JTR 482')).getByText('Confirmation…');
    expect(busyWord.getAttribute('aria-hidden')).toBe('true');
    expect(rowOf('JTR 482').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Confirmation de la présence du véhicule JTR 482…');
  });

  it('AC5: reads Sessions with no exit in English, with no French left', async () => {
    await openStaleSessions();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Sessions with no exit — Parking Démo' })).toBeDefined();
    expect(screen.getByText('2 sessions with no exit')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Vehicle present, JTR 482' }).textContent).toBe('Vehicle present');
    expect(within(rowOf('JTR 482')).getByText(/Entry confirmed/)).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('says it in English when a session is no longer open', async () => {
    const api = await openStaleSessions();
    api.answers.set(PRESENCE_REQUEST(JULIE_STALE_SESSION_ID), { status: 404, body: { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' } });
    api.staleSessions.set(parkingDemo.id, []);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await userEvent.click(screen.getByRole('button', { name: 'Vehicle present, JTR 482' }));

    expect((await screen.findByRole('alert')).textContent).toBe('The session of JTR 482 is no longer open. The list was reloaded.');
  });
});

describe('the lot of Pierre Roy', () => {
  it('has no sessions with no exit and offers the same page for its own lot', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}/stale-sessions` });

    expect(await screen.findByText('Aucune session sans sortie.')).toBeDefined();
  });
});

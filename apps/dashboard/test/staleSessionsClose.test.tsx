import type { DashboardSessionDetail, DashboardSpotToCheck } from '@palier/shared-types';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { OPEN_SESSION_ID, stepOf } from './fakeSessionData.ts';
import { JULIE_STALE_SESSION_ID } from './fakeStaleSessionData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/stale-sessions`;
const CLOSE_REQUEST = (sessionId: string) => `POST /lots/${parkingDemo.id}/stale-sessions/${sessionId}/close`;
const rowOf = (plate: string): HTMLElement => screen.getByRole('link', { name: plate }).closest('tr') as HTMLElement;
const closeButton = (plate: string) => screen.getByRole('button', { name: `Clore à la dernière preuve, ${plate}` });
const questionText = (): string | undefined => document.querySelector('.delete-question > span')?.textContent?.replace(/\s+/g, ' ');
const confirmButton = (plate: string) => screen.getByRole('button', { name: `Confirmer la clôture de ${plate}` });

async function openStaleSessions() {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path: PAGE });
  await screen.findByRole('table');
  return api;
}

async function closeJulie() {
  await userEvent.click(closeButton('JTR 482'));
  await userEvent.click(confirmButton('JTR 482'));
}

describe('closing a stale session at its last proof (story #75)', () => {
  it('asks on the row first, with the plate, and sends nothing yet', async () => {
    const api = await openStaleSessions();

    await userEvent.click(closeButton('JTR 482'));

    expect(questionText()).toBe('Clore la session de JTR 482 à sa dernière preuve, sans prélèvement ?');
    expect(document.activeElement).toBe(confirmButton('JTR 482'));
    expect(api.requests).not.toContain(CLOSE_REQUEST(JULIE_STALE_SESSION_ID));
  });

  it('AC1: takes the session off the list once confirmed, says nothing is charged and keeps the other one', async () => {
    const api = await openStaleSessions();

    await closeJulie();

    expect(await screen.findByText('Session de JTR 482 close à sa dernière preuve. Rien n’est prélevé et la place est à vérifier.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'JTR 482' })).toBeNull();
    expect(screen.getByRole('link', { name: 'MGA 913' })).toBeDefined();
    expect(api.requests.filter((request) => request === CLOSE_REQUEST(JULIE_STALE_SESSION_ID))).toHaveLength(1);
  });

  it('moves focus to the next row after a closing', async () => {
    await openStaleSessions();

    await closeJulie();
    await screen.findByText(/Session de JTR 482 close/);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Véhicule présent, MGA 913' }));
  });

  it.each([
    ['Annuler', () => userEvent.click(screen.getByRole('button', { name: 'Annuler' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('backs out with %s, sends nothing and gives the focus back to the close button', async (_case, backOut) => {
    const api = await openStaleSessions();
    await userEvent.click(closeButton('JTR 482'));

    await backOut();

    expect(screen.queryByText(/Clore la session de JTR 482/)).toBeNull();
    expect(document.activeElement).toBe(closeButton('JTR 482'));
    expect(api.requests).not.toContain(CLOSE_REQUEST(JULIE_STALE_SESSION_ID));
  });

  it('shows the busy word and the status line while the closing runs', async () => {
    const api = await openStaleSessions();
    api.answers.set(CLOSE_REQUEST(JULIE_STALE_SESSION_ID), 'pending');

    await closeJulie();

    expect(confirmButton('JTR 482').textContent).toBe('Clôture…');
    expect(rowOf('JTR 482').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Clôture de la session de JTR 482…');
  });

  it('reloads the list and names the vehicle when its session is no longer open or flagged', async () => {
    const api = await openStaleSessions();
    api.answers.set(CLOSE_REQUEST(JULIE_STALE_SESSION_ID), { status: 404, body: { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' } });
    api.staleSessions.set(parkingDemo.id, (api.staleSessions.get(parkingDemo.id) ?? []).slice(1));

    await closeJulie();

    expect((await screen.findByRole('alert')).textContent).toBe('La session de JTR 482 n’est plus ouverte. La liste a été rechargée.');
    expect(screen.queryByRole('link', { name: 'JTR 482' })).toBeNull();
    expect(screen.getByRole('link', { name: 'MGA 913' })).toBeDefined();
  });

  it('keeps the row and says the lot is busy beside it', async () => {
    const api = await openStaleSessions();
    api.answers.set(CLOSE_REQUEST(JULIE_STALE_SESSION_ID), { status: 503, body: { statusCode: 503, error: 'LOT_BUSY', message: 'busy' } });

    await closeJulie();

    const alert = await within(rowOf('JTR 482')).findByRole('alert');
    expect(alert.textContent).toBe('Le stationnement est occupé par une autre opération. Réessayez dans quelques secondes.');
    expect(closeButton('JTR 482').getAttribute('aria-describedby')).toBe(alert.id);
    expect(screen.getByRole('button', { name: 'Véhicule présent, JTR 482' }).getAttribute('aria-describedby')).toBeNull();
  });

  it('reads the closing in English, with no French left', async () => {
    await openStaleSessions();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await userEvent.click(screen.getByRole('button', { name: 'Close at last known proof, JTR 482' }));

    expect(questionText()).toBe('Close the session of JTR 482 at its last known proof, with no charge?');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm closing JTR 482' }));
    expect(await screen.findByText('Session of JTR 482 closed at its last known proof. Nothing is charged and the spot is to check.')).toBeDefined();
  });
});

describe('what a staff closing leaves on the other pages (story #75)', () => {
  it('words the closing as a step of the visit', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === OPEN_SESSION_ID);
    const detail = { ...(visit?.detail as DashboardSessionDetail), timeline: [stepOf([9, 'CLOSED_BY_STAFF', '14:00:00'])] };
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail }]);
    renderDashboard({ path: `/lots/${parkingDemo.id}/sessions/${OPEN_SESSION_ID}` });

    expect(await screen.findByText('Close par le personnel à la dernière preuve, sans prélèvement')).toBeDefined();
  });

  it('gives the freed spot its reason in the spots to check', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const spot: DashboardSpotToCheck = {
      spotId: '00000000-0000-4000-8000-000000007501',
      number: 'A-1',
      levelCode: 'P1',
      aisleCode: 'A',
      since: '2026-11-13T14:00:00.000Z',
      reason: 'STALE_SESSION',
      state: 'AVAILABLE',
      clearable: true,
      heldBySession: false,
    };
    api.spotsToCheck.set(parkingDemo.id, [spot]);
    renderDashboard({ path: `/lots/${parkingDemo.id}/spots-to-check` });

    expect(await screen.findByText(/session close sans sortie/)).toBeDefined();
  });

  it('counts the staff closings under Personnel in the exits', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.exitShares.set(parkingDemo.id, { lotName: 'Parking Démo', totalExits: 4, counts: { BEACON: 1, APP: 1, PLATE: 1, TRANSPONDER: 0, STAFF: 1 } });
    renderDashboard({ path: `/lots/${parkingDemo.id}/exits` });

    const shares = await screen.findByRole('list', { name: /Sorties par mode/ });
    expect(shares.textContent?.replace(/\s+/g, ' ')).toContain('Personnel 25 %');
  });
});

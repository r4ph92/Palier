import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { OPEN_SESSION_ID, PAID_SESSION_ID, seededSessions, type FakeVisit } from './fakeSessionData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/sessions`;
const OPEN_REQUEST = `GET /lots/${parkingDemo.id}/sessions?status=OPEN`;
const ALL_REQUEST = `GET /lots/${parkingDemo.id}/sessions?status=ALL`;

const rowOf = (plate: string): HTMLElement => screen.getByRole('link', { name: plate }).closest('tr') as HTMLElement;
const platesShown = (): string[] => screen.queryAllByRole('rowheader').map((header) => header.textContent ?? '');

async function openSessions(path = PAGE) {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path });
  await screen.findByRole('group');
  return api;
}

function manyVisits(count: number): FakeVisit[] {
  const [template] = seededSessions().get(parkingDemo.id) ?? [];
  if (template === undefined) {
    throw new Error('The seeded Parking Démo has sessions.');
  }
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-0000000009${String(index).padStart(2, '0')}`,
    detail: { ...template.detail, summary: { ...template.detail.summary, plate: `PLQ ${String(index).padStart(3, '0')}` } },
  }));
}

describe('the sessions page', () => {
  it('lists the open sessions first, in French, and reads only that filter', async () => {
    const api = await openSessions();

    expect(await screen.findByRole('table', { name: 'Sessions du stationnement, de la plus récente à la plus ancienne' })).toBeDefined();
    expect(platesShown()).toEqual(['JTR 482']);
    expect(within(rowOf('JTR 482')).getByText('Entrée confirmée')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions — Parking Démo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'En cours' }).getAttribute('aria-pressed')).toBe('true');
    expect(api.requests).toContain(OPEN_REQUEST);
    expect(api.requests).not.toContain(ALL_REQUEST);
  });

  it('shows every session, newest first, with the date, state, assigned spot and amount, after Toutes', async () => {
    const api = await openSessions();

    await userEvent.click(screen.getByRole('button', { name: 'Toutes' }));

    expect(await screen.findByRole('link', { name: 'MGA 315' })).toBeDefined();
    expect(platesShown()).toEqual(['JTR 482', 'MGA 315', 'ELC 907', 'NBD 660']);
    const paid = rowOf('MGA 315');
    expect(within(paid).getByText('Sortie, payée')).toBeDefined();
    expect(within(paid).getByText('12,00 $')).toBeDefined();
    expect(within(paid).getByText('A-1')).toBeDefined();
    expect(within(paid).getByText(/nov/)).toBeDefined();
    expect(within(rowOf('JTR 482')).getByText('—')).toBeDefined();
    expect(within(rowOf('NBD 660')).getByText('Sortie, paiement en attente')).toBeDefined();
    expect(api.requests).toContain(ALL_REQUEST);
    expect(screen.getByRole('button', { name: 'Toutes' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('links each plate to the session page', async () => {
    await openSessions();

    expect(screen.getByRole('link', { name: 'JTR 482' }).getAttribute('href')).toBe(`${PAGE}/${OPEN_SESSION_ID}`);
  });

  it('says when no session is open, and when there is none at all', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.sessions.set(parkingDemo.id, []);
    renderDashboard({ path: PAGE });

    expect(await screen.findByText('Aucune session en cours.')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Toutes' }));
    expect(await screen.findByText('Aucune session pour l’instant.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('pages: Plus anciennes appends the next 50 and goes away on the last page', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.sessions.set(parkingDemo.id, manyVisits(52).map((visit) => ({ ...visit, detail: { ...visit.detail, summary: { ...visit.detail.summary, state: 'ENTRY_CONFIRMED' as const } } })));
    renderDashboard({ path: PAGE });
    await screen.findByRole('table');

    expect(platesShown()).toHaveLength(50);
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('status').textContent).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Plus anciennes' }));

    expect(await screen.findByRole('link', { name: 'PLQ 051' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'PLQ 050' }));
    expect(screen.getByRole('status').textContent).toBe('2 sessions de plus');
    expect(platesShown()).toHaveLength(52);
    expect(screen.queryByRole('button', { name: 'Plus anciennes' })).toBeNull();
    expect(api.requests.at(-1)).toMatch(/sessions\?status=OPEN&before=00000000-0000-4000-8000-000000000949$/);
  });

  it('says so beside the button when the older sessions cannot be loaded, and keeps the rows', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.sessions.set(parkingDemo.id, manyVisits(51).map((visit) => ({ ...visit, detail: { ...visit.detail, summary: { ...visit.detail.summary, state: 'ENTRY_CONFIRMED' as const } } })));
    renderDashboard({ path: PAGE });
    await screen.findByRole('table');
    api.answers.set(`GET /lots/${parkingDemo.id}/sessions?status=OPEN&before=00000000-0000-4000-8000-000000000949`, { status: 500 });

    await userEvent.click(screen.getByRole('button', { name: 'Plus anciennes' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(platesShown()).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Plus anciennes' })).toBeDefined();
  });

  it('offers a retry when the first read fails, then lists the sessions', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [OPEN_REQUEST]: { status: 500 } } });
    renderDashboard({ path: PAGE });

    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    api.answers.delete(OPEN_REQUEST);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('link', { name: 'JTR 482' })).toBeDefined();
  });

  it('reads as not found for another operator\'s lot', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('heading', { name: 'Introuvable' })).toBeDefined();
  });

  it('is reached from the lot page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Sessions' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions — Parking Démo' })).toBeDefined();
  });

  it('says no session is open on a lot that has none', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    api.sessions.set(garageRoy.id, []);
    renderDashboard({ path: `/lots/${garageRoy.id}/sessions` });

    expect(await screen.findByText('Aucune session en cours.')).toBeDefined();
  });

  it('speaks English with no French left on the page', async () => {
    window.localStorage.setItem('palier.language', 'en');
    await openSessions();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await screen.findByRole('link', { name: 'MGA 315' });

    expect(screen.getByRole('table', { name: 'Sessions of the parking lot, newest first' })).toBeDefined();
    expect(within(rowOf('MGA 315')).getByText('Left, paid')).toBeDefined();
    expect(within(rowOf('MGA 315')).getByText('$12.00')).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Assigned spot' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('shows no session id', async () => {
    await openSessions();

    expect(document.body.textContent).not.toContain(PAID_SESSION_ID);
  });
});

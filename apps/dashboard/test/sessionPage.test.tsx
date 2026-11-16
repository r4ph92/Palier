import type { DashboardSessionDetail } from '@palier/shared-types';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClockTimeWithSeconds } from '../src/i18n/formatNumbers.ts';
import { installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { OPEN_SESSION_ID, PAID_SESSION_ID, PENDING_SESSION_ID, stepOf, UNPAID_SESSION_ID } from './fakeSessionData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const sessionPage = (sessionId: string) => `/lots/${parkingDemo.id}/sessions/${sessionId}`;
const sessionRequest = (sessionId: string) => `GET /lots/${parkingDemo.id}/sessions/${sessionId}`;
const POLL_MILLISECONDS = 15_000;

const stepTexts = (): string[] => [...document.querySelectorAll('.timeline-label')].map((label) => label.textContent ?? '');
const factOf = (summary: HTMLElement, label: string): string | undefined =>
  within(summary).getAllByRole('term').find((term) => term.textContent === label)?.closest('div')?.querySelector('dd')?.textContent;

async function openSession(sessionId: string) {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path: sessionPage(sessionId) });
  await screen.findByRole('heading', { level: 2, name: 'Déroulement' });
  return api;
}

describe('the session page', () => {
  it('reaches the page from a row of the sessions list', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}/sessions` });

    await userEvent.click(await screen.findByRole('link', { name: 'JTR 482' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Session JTR 482' })).toBeDefined();
    expect(screen.getByText('Parking Démo')).toBeDefined();
  });

  it('lists the steps of a full visit in order, the entry and the exit barrier told apart', async () => {
    await openSession(PAID_SESSION_ID);

    expect(stepTexts()).toEqual([
      'Scan à l’entrée',
      'Ouverture de la barrière d’entrée',
      'Boucle d’entrée franchie',
      'Allée détectée : B (pas l’allée attribuée)',
      'Stationnement présumé (à pied)',
      'Sortie identifiée (plaque)',
      'Ouverture de la barrière de sortie',
      'Paiement capté : 12,00 $',
      'Boucle de sortie franchie',
    ]);
  });

  it('gives each step its time with the seconds, in mono', async () => {
    await openSession(PAID_SESSION_ID);

    const [scan] = screen.getAllByRole('listitem');
    const time = scan?.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-11-15T14:00:00.000Z');
    expect(time?.textContent).toBe(formatClockTimeWithSeconds(new Date('2026-11-15T14:00:00.000Z'), 'fr'));
    expect(time?.className).toContain('figure');
  });

  it('sets the amount of a payment in a figure', async () => {
    await openSession(PAID_SESSION_ID);

    const payment = screen.getByText(/Paiement capté/).closest('li');
    expect(payment?.querySelector('.figure:not(time)')?.textContent).toBe('12,00 $');
  });

  it('summarises the stay: plate, spots, proof, exit method, amount and times', async () => {
    await openSession(PAID_SESSION_ID);

    const summary = screen.getByRole('heading', { level: 2, name: 'Résumé' }).closest('section') as HTMLElement;
    const fact = (label: string) => factOf(summary, label);
    expect(fact('Plaque')).toBe('MGA 315');
    expect(fact('État')).toBe('Sortie, payée');
    expect(fact('Place attribuée')).toBe('A-1');
    expect(fact('Place réelle')).toBe('A-1');
    expect(fact('Preuve de stationnement')).toBe('À pied');
    expect(fact('Identification à la sortie')).toBe('Plaque');
    expect(fact('Montant')).toBe('12,00 $');
    expect(within(summary).queryByText('Solde impayé')).toBeNull();
  });

  it('shows a refused balance as a second line after the payment, and in the summary', async () => {
    await openSession(UNPAID_SESSION_ID);

    const texts = stepTexts();
    expect(texts.some((text) => text.includes('Paiement capté : 25,00 $'))).toBe(true);
    expect(texts.at(-1)).toContain('Solde impayé : 3,00 $');
    const summary = screen.getByRole('heading', { level: 2, name: 'Résumé' }).closest('section') as HTMLElement;
    expect(within(summary).getByText('Solde impayé').closest('div')?.querySelector('dd')?.textContent).toBe('3,00 $');
  });

  it('shows a pending capture with its amount and no payment line', async () => {
    await openSession(PENDING_SESSION_ID);

    const texts = stepTexts();
    expect(texts.at(-1)).toContain('Capture en attente : 12,00 $');
    expect(texts.some((text) => text.includes('Paiement capté'))).toBe(false);
    expect(screen.getByText('Sortie, paiement en attente')).toBeDefined();
  });

  it('renders a partial timeline: only the payment', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === PAID_SESSION_ID);
    api.sessions.set(parkingDemo.id, [{ id: PAID_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline: [stepOf([8, 'CAPTURED', '16:00:02'], { amountCents: 1200, unpaidCents: 0 })] } }]);
    renderDashboard({ path: sessionPage(PAID_SESSION_ID) });

    await screen.findByText(/Paiement capté/);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('words the operator presence check as a step of the visit', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === OPEN_SESSION_ID);
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline: [stepOf([9, 'PRESENCE_CONFIRMED', '14:00:00'])] } }]);
    renderDashboard({ path: sessionPage(OPEN_SESSION_ID) });

    expect(await screen.findByText('Présence du véhicule confirmée')).toBeDefined();
  });

  it('says so when no step was recorded', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === OPEN_SESSION_ID);
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline: [] } }]);
    renderDashboard({ path: sessionPage(OPEN_SESSION_ID) });

    expect(await screen.findByText('Aucune étape enregistrée pour cette session.')).toBeDefined();
    expect(screen.queryAllByRole('listitem')).toEqual([]);
  });

  it('names a step of a kind the page does not know "Autre étape", with its time', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === OPEN_SESSION_ID);
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline: [stepOf([1, 'UNKNOWN', '14:00:00'])] } }]);
    renderDashboard({ path: sessionPage(OPEN_SESSION_ID) });

    expect(await screen.findByText('Autre étape')).toBeDefined();
  });

  it('reads as not found for a session of no lot of the member, and for another operator', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: sessionPage('00000000-0000-4000-8000-000000000999') });
    expect(await screen.findByRole('heading', { name: 'Introuvable' })).toBeDefined();
  });

  it('reads as not found for another operator\'s lot', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: sessionPage(PAID_SESSION_ID) });

    expect(await screen.findByRole('heading', { name: 'Introuvable' })).toBeDefined();
  });

  it('offers a retry when the read fails', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [sessionRequest(PAID_SESSION_ID)]: { status: 500 } } });
    renderDashboard({ path: sessionPage(PAID_SESSION_ID) });

    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    api.answers.delete(sessionRequest(PAID_SESSION_ID));
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Session MGA 315' })).toBeDefined();
  });

  it('speaks English with no French left on the page', async () => {
    window.localStorage.setItem('palier.language', 'en');
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: sessionPage(UNPAID_SESSION_ID) });
    await screen.findByRole('heading', { level: 2, name: 'Timeline' });

    expect(screen.getByText('Identified at the exit by')).toBeDefined();
    expect(stepTexts().some((text) => text.includes('Payment captured: $25.00'))).toBe(true);
    expect(stepTexts().at(-1)).toContain('Unpaid balance: $3.00');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });
});

describe('the session page while time passes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advanceOnePoll() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
    });
  }

  it('reads an open session again and shows the steps that came since', async () => {
    const api = await openSession(OPEN_SESSION_ID);
    const visit = api.sessions.get(parkingDemo.id)?.[0];
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline: [...(visit?.detail.timeline ?? []), stepOf([5, 'PARKING_PRESUMED', '14:02:00'], { evidence: 'TIMEOUT' })] } }]);

    await advanceOnePoll();

    expect(screen.getByText('Stationnement présumé (délai écoulé)')).toBeDefined();
    expect(api.requests.filter((request) => request === sessionRequest(OPEN_SESSION_ID))).toHaveLength(2);
  });

  it('does not read a session that ended again', async () => {
    const api = await openSession(PAID_SESSION_ID);

    await advanceOnePoll();
    await advanceOnePoll();

    expect(api.requests.filter((request) => request === sessionRequest(PAID_SESSION_ID))).toHaveLength(1);
  });

  it('stops reading when the session is gone, and shows not found', async () => {
    const api = await openSession(OPEN_SESSION_ID);
    api.answers.set(sessionRequest(OPEN_SESSION_ID), { status: 404, body: { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' } });

    await advanceOnePoll();
    await advanceOnePoll();

    expect(screen.getByRole('heading', { name: 'Introuvable' })).toBeDefined();
    expect(api.requests.filter((request) => request === sessionRequest(OPEN_SESSION_ID))).toHaveLength(2);
  });
});

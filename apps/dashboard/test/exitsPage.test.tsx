import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/exits`;
const WHITESPACE = /\s+/g;

function sharesLine(): string {
  return (screen.getByRole('list', { name: /Sorties par mode|Exits by identification/ }).textContent ?? '').replace(WHITESPACE, ' ').trim();
}

describe('the exits page', () => {
  it('AC1: shows the five shares of the 10 exits of Parking Démo in one line, in French', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('heading', { level: 1, name: 'Sorties — Parking Démo' })).toBeDefined();
    expect(sharesLine()).toBe('Balise 50 % · App 30 % · Plaque 20 % · Transpondeur 0 % · Personnel 0 %');
    expect(screen.getByText(/Sorties sur 30 jours/).textContent).toMatch(/10$/);
  });

  it('AC2: reads « Aucune sortie sur 30 jours » for a lot with no exit', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}/exits` });

    expect(await screen.findByText('Aucune sortie sur 30 jours')).toBeDefined();
    expect(screen.queryByRole('list', { name: /Sorties par mode/ })).toBeNull();
  });

  it('AC3: reads the shares in English once the language is switched', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });
    await screen.findByRole('list');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exits — Parking Démo' })).toBeDefined();
    expect(sharesLine()).toBe('Beacon 50% · App 30% · Plate 20% · Transponder 0% · Staff 0%');
  });

  it('rounds each share on its own', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.exitShares.set(parkingDemo.id, { lotName: 'Parking Démo', totalExits: 3, counts: { BEACON: 1, APP: 1, PLATE: 1, TRANSPONDER: 0, STAFF: 0 } });
    renderDashboard({ path: PAGE });

    await screen.findByRole('list');

    expect(sharesLine()).toBe('Balise 33 % · App 33 % · Plaque 33 % · Transpondeur 0 % · Personnel 0 %');
  });

  it('is reachable from the lot page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    const link = await screen.findByRole('link', { name: 'Sorties' });

    expect(link.getAttribute('href')).toBe(PAGE);
  });

  it('gives Pierre not found for the exits of Parking Démo', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Balise/)).toBeNull();
  });

  it('offers a retry when the read fails, then shows the shares', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [`GET /lots/${parkingDemo.id}/exits`]: { status: 500, body: { statusCode: 500, error: 'INTERNAL', message: 'x' } } } });
    renderDashboard({ path: PAGE });
    const retry = await screen.findByRole('button', { name: /Réessayer/ });

    api.answers.clear();
    await userEvent.click(retry);

    expect(await screen.findByRole('list')).toBeDefined();
  });
});

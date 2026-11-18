import type { LotExitShares } from '@palier/shared-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/exits`;
const WHITESPACE = /\s+/g;
const HOSTILE_NAME = '<img src=x onerror=alert(1)> Démo 🚗';

function sharesLine(): string {
  return (screen.getByRole('list', { name: /Sorties par mode|Exits by identification/ }).textContent ?? '').replace(WHITESPACE, ' ').trim();
}

function summaryLine(): string {
  return (screen.getByText(/Sorties sur 30 jours|Exits in 30 days/).textContent ?? '').replace(WHITESPACE, ' ');
}

async function openWith(shares: LotExitShares) {
  const api = installFakeApi({ signedInAs: sophie });
  api.exitShares.set(parkingDemo.id, shares);
  renderDashboard({ path: PAGE });
  await screen.findByRole('heading', { level: 1, name: new RegExp(`^Sorties — `) });
  return api;
}

describe('QA #78: the exits page, attacked', () => {
  it('reads 50 000 exits with the French thousands space, then 50,000 in English', async () => {
    await openWith({ lotName: parkingDemo.name, totalExits: 50_000, counts: { BEACON: 49_951, APP: 49, PLATE: 0, TRANSPONDER: 0, STAFF: 0 } });

    expect(summaryLine()).toBe('Sorties sur 30 jours : 50 000');
    expect(sharesLine()).toBe('Balise 100 % · App 0 % · Plaque 0 % · Transpondeur 0 % · Personnel 0 %');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(summaryLine()).toBe('Exits in 30 days: 50,000');
    expect(sharesLine()).toBe('Beacon 100% · App 0% · Plate 0% · Transponder 0% · Staff 0%');
  });

  it('rounds a two-thirds split to 67 % and 33 %', async () => {
    await openWith({ lotName: parkingDemo.name, totalExits: 3, counts: { BEACON: 2, APP: 0, PLATE: 0, TRANSPONDER: 1, STAFF: 0 } });

    expect(sharesLine()).toBe('Balise 67 % · App 0 % · Plaque 0 % · Transpondeur 33 % · Personnel 0 %');
  });

  it('shows a single exit as 100 % of its method and keeps the five methods in the AC order', async () => {
    await openWith({ lotName: parkingDemo.name, totalExits: 1, counts: { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 1, STAFF: 0 } });

    expect(summaryLine()).toBe('Sorties sur 30 jours : 1');
    expect(sharesLine()).toBe('Balise 0 % · App 0 % · Plaque 0 % · Transpondeur 100 % · Personnel 0 %');
  });

  it('shows a lot name holding HTML and emoji as text in the heading, never as markup', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.exitShares.set(parkingDemo.id, { lotName: HOSTILE_NAME, totalExits: 10, counts: { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0, STAFF: 0 } });
    renderDashboard({ path: PAGE });

    expect(await screen.findByRole('heading', { level: 1, name: `Sorties — ${HOSTILE_NAME}` })).toBeDefined();
    expect(document.querySelector('main img')).toBeNull();
  });

  it('goes back to the lot page from the exits page', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });

    const back = await screen.findByRole('link', { name: 'Retour au stationnement' });

    expect(back.getAttribute('href')).toBe(`/lots/${parkingDemo.id}`);
  });

  it('names the link from the lot page « Exits » in English', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });
    await screen.findByRole('link', { name: 'Sorties' });

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect((await screen.findByRole('link', { name: 'Exits' })).getAttribute('href')).toBe(PAGE);
  });

  it('asks for the exits once when the page opens, and once more on the language switch at most', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });
    await screen.findByRole('list');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { level: 1, name: 'Exits — Parking Démo' });

    const reads = api.requests.filter((request) => request === `GET /lots/${parkingDemo.id}/exits`).length;
    expect(reads).toBe(1);
  });
});

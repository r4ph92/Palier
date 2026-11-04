import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('dashboard shell', () => {
  it('names the product in the header and lets the sign-in page name itself in its eyebrow', async () => {
    installFakeApi();
    renderDashboard();

    await screen.findByRole('heading', { level: 1, name: 'Connexion' });

    expect(screen.getByText('Palier').getAttribute('lang')).toBe('fr');
    expect(screen.getAllByText('Tableau de bord')).toHaveLength(1);
  });

  it('gives the unreachable page its own eyebrow', async () => {
    installFakeApi({ answers: { 'GET /me': { status: 503 } } });
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Palier est injoignable' })).toBeDefined();
    expect(screen.getByText('Erreur réseau')).toBeDefined();
  });
});

describe('page focus and title', () => {
  it('leaves focus alone on the first page, so the first Tab reaches the skip link', async () => {
    installFakeApi();
    renderDashboard();
    await screen.findByRole('heading', { level: 1, name: 'Connexion' });

    expect(document.activeElement).toBe(document.body);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Aller au contenu' }));
  });

  it('moves focus to the title of the page Sophie opens', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard();

    await userEvent.click(await screen.findByRole('link', { name: /Parking Démo/ }));

    expect(document.activeElement).toBe(await screen.findByRole('heading', { level: 1, name: 'Parking Démo' }));
  });

  it('titles the document and gives it a heading in English while the session loads', async () => {
    window.localStorage.setItem('palier.language', 'en');
    installFakeApi({ answers: { 'GET /me': 'pending' } });
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Palier dashboard' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(document.title).toBe('Palier dashboard');
  });
});

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from './fakeDashboardApi.ts';
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

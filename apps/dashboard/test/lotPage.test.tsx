import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('lot page', () => {
  it('gives Pierre not found and nothing about Parking Démo at its address', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Parking Démo/)).toBeNull();
    await waitFor(() => expect(document.title).toBe('Introuvable · Tableau de bord Palier'));
  });

  it('opens Parking Démo from Sophie’s list and comes back', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard();

    await userEvent.click(await screen.findByRole('link', { name: /Parking Démo/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(`/lots/${parkingDemo.id}`);
    expect(screen.getByText('En ligne')).toBeDefined();

    await userEvent.click(screen.getByRole('link', { name: 'Retour aux stationnements' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' })).toBeDefined();
  });

  it('shows Parking Démo as unavailable with a way back, and opens it once the retry succeeds', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [`GET /lots/${parkingDemo.id}`]: { status: 500 } } });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    expect(await screen.findByRole('heading', { level: 1, name: 'Stationnement indisponible' })).toBeDefined();
    expect(screen.getByText('Stationnement')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(screen.getByRole('link', { name: 'Retour aux stationnements' })).toBeDefined();
    const actions = screen.getByRole('button', { name: 'Réessayer' }).parentElement;
    expect(actions?.className).toBe('actions-row');
    expect(actions?.contains(screen.getByRole('link', { name: 'Retour aux stationnements' }))).toBe(true);
    api.answers.delete(`GET /lots/${parkingDemo.id}`);

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Parking Démo' })).toBeDefined();
  });

  it('answers not found for an address the dashboard does not know', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: '/operators/settings' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
  });
});

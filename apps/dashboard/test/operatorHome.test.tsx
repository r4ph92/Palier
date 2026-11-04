import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('operator home while the lots load', () => {
  it('announces the loading, then shows two placeholder rows once 300 ms have passed', async () => {
    installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': 'pending' } });
    const { container } = renderDashboard();
    await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' });

    expect(screen.getByRole('status').textContent).toBe('Chargement des stationnements…');
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(0);

    await waitFor(() => expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2));
    expect(screen.getByRole('status').textContent).toBe('Chargement des stationnements…');
  });
});

describe('operator home when the lots fail', () => {
  it('offers Réessayer, which loads the lots again', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': { status: 500 } } });
    renderDashboard();
    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');

    api.answers.delete('GET /lots');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('link', { name: /Parking Démo/ })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('retrying the lots', () => {
  it('keeps the failure and a disabled Réessayer on screen while the lots load again', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': { status: 500 } } });
    renderDashboard();
    await screen.findByRole('alert');

    api.answers.set('GET /lots', 'pending');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Réessayer' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('moves focus to the Stationnements heading when the lots come back', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': { status: 500 } } });
    renderDashboard();
    await screen.findByRole('alert');

    api.answers.delete('GET /lots');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await screen.findByRole('link', { name: /Parking Démo/ });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Stationnements' }));
  });

  it('moves focus to the error when the second attempt fails too', async () => {
    installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': { status: 500 } } });
    renderDashboard();
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')));
  });
});

describe('a session that ends while the dashboard is open', () => {
  it('returns Sophie to the sign-in page when a lot answers 401', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard();
    const parkingDemoLink = await screen.findByRole('link', { name: /Parking Démo/ });

    api.me = null;
    await userEvent.click(parkingDemoLink);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(api.requests.slice(-2)).toEqual([`GET /lots/${parkingDemo.id}`, 'GET /me']);
  });
});

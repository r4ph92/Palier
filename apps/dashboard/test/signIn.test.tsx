import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('dashboard sign-in', () => {
  it('signs Sophie in through Connexion de test and shows her operator and its lots', async () => {
    installFakeApi();
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: 'Sophie Lavoie' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' })).toBeDefined();
    expect(await screen.findByRole('link', { name: /Parking Démo/ })).toBeDefined();
    expect(screen.getByRole('link', { name: /Parking Test Paliers/ })).toBeDefined();
    expect(screen.getByText('Vérifié')).toBeDefined();
  });

  it('sends the dashboard header with the sign-in', async () => {
    installFakeApi();
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: 'Sophie Lavoie' }));
    await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' });

    const signInCall = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([url]) => url.endsWith('/test/sign-in'));
    expect(signInCall?.[1].headers).toMatchObject({ 'x-requested-with': 'palier-dashboard' });
    expect(signInCall?.[1].credentials).toBe('same-origin');
  });

  it('keeps focus on Sophie while her sign-in is on its way and ignores a second pick', async () => {
    const api = installFakeApi({ answers: { 'POST /test/sign-in': 'pending' } });
    renderDashboard();
    const sophieRow = await screen.findByRole('button', { name: /Sophie Lavoie/ });

    await userEvent.click(sophieRow);
    await userEvent.click(screen.getByRole('button', { name: /Pierre Roy/ }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Pierre Roy/ }));
    expect(screen.getByRole('button', { name: /Pierre Roy/ }).getAttribute('aria-disabled')).toBe('true');
    expect(api.requests.filter((request) => request === 'POST /test/sign-in')).toHaveLength(1);
  });

  it('moves focus to the notice when the sign-in fails', async () => {
    installFakeApi({ answers: { 'POST /test/sign-in': { status: 500 } } });
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: 'Sophie Lavoie' }));

    expect(document.activeElement).toBe(await screen.findByRole('alert'));
    expect(screen.getByRole('button', { name: 'Sophie Lavoie' }).getAttribute('aria-disabled')).toBe('false');
  });

  it('signs out back to the sign-in page', async () => {
    installFakeApi();
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Sophie Lavoie' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
  });

  it('keeps Sophie signed in and says so when the sign-out fails, then signs out on a second try', async () => {
    const api = installFakeApi({ answers: { 'POST /sign-out': { status: 500 } } });
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Sophie Lavoie' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(screen.getByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' })).toBeDefined();

    api.answers.delete('POST /sign-out');
    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

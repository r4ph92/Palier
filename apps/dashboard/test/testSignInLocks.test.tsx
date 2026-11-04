import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { allAnswersReceived, installFakeApi } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

// Without the flag or in production the section is left out while the page renders, so the page being shown is enough.
async function signInPageShown() {
  await screen.findByRole('heading', { level: 1, name: 'Connexion' });
}

describe('Connexion de test locks', () => {
  it('shows the section when the build is a development build, the flag is on and the API lists users', async () => {
    installFakeApi();
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 2, name: 'Connexion de test' })).toBeDefined();
  });

  it('hides the section when the flag is off, even though the API lists users', async () => {
    const api = installFakeApi();
    renderDashboard({ testSignInFlag: false });
    await signInPageShown();

    expect(screen.queryByText('Connexion de test')).toBeNull();
    expect(api.requests).not.toContain('GET /test/users');
  });

  it('hides the section in a production build, even with the flag on', async () => {
    const api = installFakeApi();
    vi.stubEnv('DEV', false);
    renderDashboard();
    await signInPageShown();

    expect(screen.queryByText('Connexion de test')).toBeNull();
    expect(api.requests).not.toContain('GET /test/users');
  });

  it('hides the section when the API answers not found', async () => {
    const api = installFakeApi({ testUsersListed: false });
    renderDashboard();
    await waitFor(() => expect(api.requests).toContain('GET /test/users'));
    await allAnswersReceived(api);

    expect(screen.queryByText('Connexion de test')).toBeNull();
  });
});

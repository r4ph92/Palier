import type { KycStatus } from '@palier/shared-types';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectTo } from '../src/navigation/redirectTo.ts';
import { installFakeApi, pierre, sophie } from './fakeDashboardApi.ts';
import { meFor } from './fakeDashboardData.ts';
import { STRIPE_ONBOARDING_URL } from './fakeDashboardRoutes.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

vi.mock('../src/navigation/redirectTo.ts', () => ({ redirectTo: vi.fn() }));

// Pierre's operator, Garages Roy, with the status Stripe last reported.
function installWithStatus(kycStatus: KycStatus, answers: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({ signedInAs: pierre, ...answers });
  api.me = { user: pierre, operator: { ...(meFor(pierre).operator as NonNullable<ReturnType<typeof meFor>['operator']>), kycStatus } };
  return api;
}

describe('connecting Stripe from the operator home', () => {
  beforeEach(() => vi.mocked(redirectTo).mockClear());

  it('sends Pierre to the hosted onboarding when he clicks Connecter Stripe', async () => {
    const api = installWithStatus('NOT_STARTED');
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: 'Connecter Stripe' }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(STRIPE_ONBOARDING_URL));
    expect(api.requests).toContain(`POST /operators/${api.me?.operator?.id}/stripe-onboarding`);
  });

  it('keeps the button busy while the page leaves for Stripe, so a second click starts nothing', async () => {
    const api = installWithStatus('NOT_STARTED', { answers: {} });
    renderDashboard();
    const button = await screen.findByRole('button', { name: 'Connecter Stripe' });

    await userEvent.click(button);
    await userEvent.click(screen.getByRole('button', { name: 'Redirection vers Stripe…' }));

    expect(api.requests.filter((request) => request.endsWith('/stripe-onboarding'))).toHaveLength(1);
    expect(redirectTo).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PENDING', 'Vérification en cours', 'Reprendre l’inscription Stripe'],
    ['ACTION_REQUIRED', 'Action requise', 'Reprendre l’inscription Stripe'],
  ] as const)('shows %s as "%s" with a button that resumes the onboarding', async (status, label, button) => {
    installWithStatus(status);
    renderDashboard();

    expect(await screen.findByText(label)).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: button }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(STRIPE_ONBOARDING_URL));
  });

  it('shows Vérifié with no button once Stripe has verified the account', async () => {
    installWithStatus('VERIFIED');
    renderDashboard();

    expect(await screen.findByText('Vérifié')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Stripe/ })).toBeNull();
  });

  it('tells Pierre Stripe is unavailable and lets him try again', async () => {
    const api = installWithStatus('NOT_STARTED');
    api.answers.set(`POST /operators/${api.me?.operator?.id}/stripe-onboarding`, { status: 503, body: { error: 'STRIPE_UNAVAILABLE' } });
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: 'Connecter Stripe' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Stripe est injoignable pour l’instant. Réessayez dans un instant.');
    expect(redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connecter Stripe' }).getAttribute('aria-disabled')).toBe('false');
  });

  it('returns to the sign-in page when the session has ended', async () => {
    const api = installWithStatus('NOT_STARTED');
    renderDashboard();
    const button = await screen.findByRole('button', { name: 'Connecter Stripe' });

    api.me = null;
    await userEvent.click(button);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('shows Sophie, whose operator is verified, no Stripe button', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard();

    await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' });
    expect(screen.queryByRole('button', { name: /Stripe/ })).toBeNull();
  });
});

describe('the Stripe status in English', () => {
  it.each([
    ['NOT_STARTED', 'Not started', 'Connect Stripe'],
    ['PENDING', 'Verification in progress', 'Resume Stripe onboarding'],
    ['ACTION_REQUIRED', 'Action required', 'Resume Stripe onboarding'],
  ] as const)('reads "%s" as "%s" with the button "%s", with no French left', async (status, label, button) => {
    installWithStatus(status);
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByText(label)).toBeDefined();
    expect(screen.getByRole('button', { name: button })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('reads Verified', async () => {
    installWithStatus('VERIFIED');
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByText('Verified')).toBeDefined();
  });
});

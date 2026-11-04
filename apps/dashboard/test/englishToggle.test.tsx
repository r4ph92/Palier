import type { DashboardUser } from '@palier/shared-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, nouvelOperateur, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { seededNames } from './fakeDashboardData.ts';
import { translatedFrenchFragments } from './frenchStrings.ts';
import { renderDashboard } from './renderDashboard.tsx';

interface PageCase {
  readonly page: string;
  readonly signedInAs?: DashboardUser;
  readonly path?: string;
  readonly englishHeading: string;
}

const pages: readonly PageCase[] = [
  { page: 'sign-in with test sign-in', englishHeading: 'Test sign-in' },
  { page: 'create operator', signedInAs: nouvelOperateur, englishHeading: 'Create your operator' },
  { page: 'operator home', signedInAs: sophie, englishHeading: 'Parking lots' },
  { page: 'lot', signedInAs: sophie, path: `/lots/${parkingDemo.id}`, englishHeading: 'Parking Démo' },
  { page: 'not found', signedInAs: pierre, path: `/lots/${parkingDemo.id}`, englishHeading: 'Not found' },
];

function frenchLeftOnPage(): string[] {
  const shown = seededNames.reduce((text, name) => text.replaceAll(name, ''), document.body.textContent);
  return translatedFrenchFragments().filter((fragment) => shown.includes(fragment));
}

describe('English toggle', () => {
  it.each(pages)('shows the $page page entirely in English', async ({ signedInAs, path, englishHeading }) => {
    installFakeApi(signedInAs === undefined ? {} : { signedInAs });
    renderDashboard(path === undefined ? {} : { path });

    await userEvent.click(await screen.findByRole('button', { name: 'Afficher le tableau de bord en anglais' }));
    await screen.findByRole('heading', { name: englishHeading });
    await screen.findByText(/English|Français/);

    expect(frenchLeftOnPage()).toEqual([]);
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toMatch(/· Palier dashboard$/);
  });

  it('shows the legal name error in English', async () => {
    installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Afficher le tableau de bord en anglais' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Create the operator' }));

    expect(screen.getByRole('alert').textContent).toBe('The legal name must be 2 to 120 characters.');
    expect(frenchLeftOnPage()).toEqual([]);
  });

  it('keeps English after a reload', async () => {
    installFakeApi();
    const first = renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'Afficher le tableau de bord en anglais' }));
    first.unmount();

    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
    expect(document.title).toBe('Sign in · Palier dashboard');
  });

  it('opens in French with French page titles by default', async () => {
    installFakeApi();
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(document.documentElement.lang).toBe('fr');
    expect(document.title).toBe('Connexion · Tableau de bord Palier');
  });
});

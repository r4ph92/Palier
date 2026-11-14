import type { DashboardUser } from '@palier/shared-types';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, nouvelOperateur, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
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
  { page: 'new lot', signedInAs: pierre, path: '/lots/new', englishHeading: 'Create a parking lot' },
  { page: 'occupancy', signedInAs: sophie, path: `/lots/${parkingDemo.id}/occupancy`, englishHeading: 'Occupancy — Parking Démo' },
  { page: 'lot without pricing', signedInAs: pierre, path: `/lots/${garageRoy.id}`, englishHeading: 'Garage Roy' },
  { page: 'spots to check', signedInAs: sophie, path: `/lots/${parkingDemo.id}/spots-to-check`, englishHeading: 'Spots to check' },
  { page: 'map', signedInAs: sophie, path: `/lots/${parkingDemo.id}/map`, englishHeading: 'Map and beacons — Parking Démo' },
  { page: 'empty map', signedInAs: pierre, path: `/lots/${garageRoy.id}/map`, englishHeading: 'Map and beacons — Garage Roy' },
];

describe('English toggle', () => {
  it.each(pages)('shows the $page page entirely in English', async ({ signedInAs, path, englishHeading }) => {
    installFakeApi(signedInAs === undefined ? {} : { signedInAs });
    renderDashboard(path === undefined ? {} : { path });

    await userEvent.click(await screen.findByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { name: englishHeading });
    await screen.findByText(/English|Français/);

    expect(frenchLeftOnEnglishPage()).toEqual([]);
    expect(document.documentElement.lang).toBe('en');
    await waitFor(() => expect(document.title).toMatch(/· Palier dashboard$/));
  });

  it('shows the legal name error in English', async () => {
    installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Create the operator' }));

    expect(screen.getByRole('alert').textContent).toBe('The legal name must be 2 to 120 characters, with no invisible characters.');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('keeps English after a reload', async () => {
    installFakeApi();
    const first = renderDashboard();
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));
    first.unmount();

    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Sign in · Palier dashboard'));
  });

  it('opens in French with French page titles by default', async () => {
    installFakeApi();
    renderDashboard();

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(document.documentElement.lang).toBe('fr');
    await waitFor(() => expect(document.title).toBe('Connexion · Tableau de bord Palier'));
  });
});

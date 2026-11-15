import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { entreeDemoGate, readyParkingDemo, sortieDemoGate } from './fakePublicationData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { checklistLineOf, openPublicationOf, plainText, publicationPathOf } from './publicationPageSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

const ONLINE_REQUEST = `PUT /lots/${parkingDemo.id}/online`;

describe('the go-live page under attack (QA #68)', () => {
  it('shows Pierre every missing line of a bare lot in English, the missing list included, with no French left', async () => {
    await openPublicationOf(pierre, garageRoy);

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await screen.findByRole('heading', { level: 1, name: `Go live — ${garageRoy.name}` });
    const button = screen.getByRole('button', { name: 'Put online' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(plainText(document.getElementById(button.getAttribute('aria-describedby') ?? ''))).toMatch(/^Still missing: Stripe account verified, .*Entry terminal, and Exit terminal\.$/);
    expect(checklistLineOf('Declared capacity')).toBe('Declared capacity Missing 0 spots declared');
    expect(checklistLineOf('Stripe account verified')).toBe('Stripe account verified Missing Stripe verification: Not started');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('answers a stale page’s LOT_NOT_READY in English, and the refreshed list names the gate', async () => {
    const api = await openPublicationOf(sophie, parkingDemo);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    api.publication.set(parkingDemo.id, readyParkingDemo({ gates: [entreeDemoGate, { ...sortieDemoGate, verifiedAt: null }] }));

    await userEvent.click(await screen.findByRole('button', { name: 'Put online' }));

    expect(plainText(await screen.findByRole('alert'))).toBe('A prerequisite is still missing: the parking lot stays offline. The list was read again.');
    expect(plainText(screen.getByText(/^Still missing/))).toBe('Still missing: Exit: Sortie Démo.');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('sends one request when Sophie double-clicks « Mettre en ligne », and never takes the lot back offline', async () => {
    const api = await openPublicationOf(sophie, parkingDemo);

    await userEvent.dblClick(screen.getByRole('button', { name: 'Mettre en ligne' }));

    expect(await screen.findByRole('button', { name: 'Mettre hors ligne' })).toBeDefined();
    expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([ONLINE_REQUEST]);
    expect(api.publication.get(parkingDemo.id)?.isOnline).toBe(true);
  });

  it('shows markup typed in a note as text, never as elements', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const note = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    api.publication.set(parkingDemo.id, readyParkingDemo({ wifi: { measuredOn: '2026-11-12', note } }));
    renderDashboard({ path: publicationPathOf(parkingDemo.id) });

    await screen.findByRole('heading', { level: 1, name: 'Mise en ligne — Parking Démo' });

    expect(checklistLineOf('Wi-Fi mesuré sur place')).toBe(`Wi-Fi mesuré sur place Rempli Mesuré le 12 novembre 2026 : ${note}`);
    expect(document.querySelector('main img, main script')).toBeNull();
  });
});

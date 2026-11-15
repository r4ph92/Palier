import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { readyParkingDemo, sortieDemoGate } from './fakePublicationData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { attest, attestationForm, checklistLineOf, openPublicationOf, stateWordOf } from './publicationPageSteps.ts';

const POLL_MILLISECONDS = 30_000;
const WIFI_REQUEST = `PUT /lots/${garageRoy.id}/attestations/wifi`;

describe('the on-site measures of the go-live page', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records Pierre’s Wi-Fi measure, and the checklist shows its day and note at once', async () => {
    const api = await openPublicationOf(pierre, garageRoy);

    await attest('Réseau Wi-Fi', { measuredOn: '2026-11-14', note: 'Trois barres au P1' });

    expect(await within(attestationForm('Réseau Wi-Fi')).findByText('Mesure enregistrée.')).toBeDefined();
    expect(checklistLineOf('Wi-Fi mesuré sur place')).toBe('Wi-Fi mesuré sur place Rempli Mesuré le 14 novembre 2026 : Trois barres au P1');
    expect(stateWordOf('Réseau cellulaire mesuré sur place')).toBe('Manquant');
    expect(api.requests).toContain(WIFI_REQUEST);
  });

  it('refuses a day after today beside its field, and sends nothing', async () => {
    const api = await openPublicationOf(pierre, garageRoy);

    await attest('Réseau cellulaire', { measuredOn: '2099-01-01', note: 'Quatre barres' });

    expect(within(attestationForm('Réseau cellulaire')).getByText('La date de la mesure ne peut pas être après aujourd’hui.')).toBeDefined();
    expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([]);
  });

  it('refuses an empty note with its limit, and sends nothing', async () => {
    const api = await openPublicationOf(pierre, garageRoy);

    await attest('Réseau Wi-Fi', { measuredOn: '2026-11-14', note: ' ' });

    expect(within(attestationForm('Réseau Wi-Fi')).getByText(/^La note doit compter de 1 à 300 caractères/)).toBeDefined();
    expect(api.requests).not.toContain(WIFI_REQUEST);
  });

  it('prefills a measure already recorded', async () => {
    await openPublicationOf(sophie, parkingDemo);

    expect((within(attestationForm('Réseau Wi-Fi')).getByLabelText('Jour de la mesure') as HTMLInputElement).value).toBe('2026-11-12');
    expect((within(attestationForm('Réseau Wi-Fi')).getByRole('textbox', { name: 'Constat' }) as HTMLInputElement).value).toBe('P1, P2: -62 dBm');
  });

  it('shows a gate’s test passage at the next poll, without touching a note being typed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const api = await openPublicationOf(sophie, parkingDemo);
    api.publication.set(parkingDemo.id, readyParkingDemo({ gates: [{ ...sortieDemoGate, verifiedAt: null }] }));
    const note = within(attestationForm('Réseau Wi-Fi')).getByRole('textbox', { name: 'Constat' });
    await userEvent.type(note, ' et P3');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
    });

    expect(stateWordOf('Sortie vérifiée : Sortie Démo')).toBe('Manquant');
    expect((note as HTMLInputElement).value).toBe('P1, P2: -62 dBm et P3');
  });
});

describe('the go-live page in English', () => {
  it('reads the checklist, the action and the measures in English, with no French left', async () => {
    await openPublicationOf(sophie, parkingDemo);

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Go live — Parking Démo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Put online' })).toBeDefined();
    expect(checklistLineOf('Entry verified: Entrée Démo')).toMatch(/^Entry verified: Entrée Démo Met Test passage passed on Nov 14, 3:30 PM$/);
    expect(checklistLineOf('Wi-Fi measured on site')).toBe('Wi-Fi measured on site Met Measured on November 12, 2026: P1, P2: -62 dBm');
    expect(screen.getByRole('form', { name: 'Wi-Fi network' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });
});

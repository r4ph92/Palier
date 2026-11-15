import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, parkingDemo, sophie, pierre } from './fakeDashboardApi.ts';
import { qrLinkOf } from './fakeGateData.ts';
import { sortieDemo } from './fakeEquipmentData.ts';
import { addGate, gateItemOf, keyPanel, openGatesOf } from './gatesPageSteps.ts';
import { readSheet } from './qrSheetReader.ts';

const sheets = new Map<string, Blob>();
const downloaded: Blob[] = [];

// jsdom has neither object URLs nor downloads: the test keeps each file the page hands to the browser.
beforeEach(() => {
  downloaded.length = 0;
  URL.createObjectURL = (sheet: Blob) => {
    const url = `blob:qa67-${sheets.size}`;
    sheets.set(url, sheet);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloaded.push(sheets.get(this.getAttribute('href') ?? '') as Blob);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the printed QR of an exit gate (QA #67)', () => {
  it('downloads a sheet for Sortie Démo whose QR reads as that exit gate’s own signed link, marked Sortie · Exit', async () => {
    const api = await openGatesOf(sophie, parkingDemo.id);

    await userEvent.click(within(gateItemOf(sortieDemo.name)).getByRole('button', { name: `Imprimer le QR de ${sortieDemo.name}` }));
    await waitFor(() => expect(downloaded).toHaveLength(1));

    const { document: sheet, scanned } = await readSheet(downloaded[0] as Blob);
    const sortie = api.gates.get(parkingDemo.id)?.find(({ id }) => id === sortieDemo.id);
    expect(sortie).toBeDefined();
    expect(scanned).toBe(qrLinkOf(sortie as NonNullable<typeof sortie>));
    expect(sheet.body.textContent).toContain('Sortie · Exit');
  });
});

describe('the one-time device key after leaving the page (QA #67)', () => {
  it('no longer shows a new gate’s key once Pierre leaves the gates page and comes back', async () => {
    await openGatesOf(pierre, garageRoy.id);
    await addGate({ name: 'Entrée principale' });
    const deviceKey = (await screen.findByRole('region', { name: 'Clé d’appareil — Entrée principale' })).querySelector('code')?.textContent ?? '';
    expect(deviceKey).not.toBe('');

    await userEvent.click(screen.getByRole('link', { name: 'Retour au stationnement' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Bornes et QR' }));
    await screen.findByRole('heading', { level: 2, name: 'Bornes installées' });

    expect(keyPanel()).toBeNull();
    expect(document.body.textContent).not.toContain(deviceKey);
    expect(within(gateItemOf('Entrée principale')).getByRole('button', { name: 'Régénérer la clé de Entrée principale' })).toBeDefined();
  });
});

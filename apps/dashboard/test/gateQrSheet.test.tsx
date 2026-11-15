import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { garageRoy, pierre } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { ENTREE_ROY_ID, type FakeGate, qrLinkOf } from './fakeGateData.ts';
import { addGate, gateItemOf, openGatesOf } from './gatesPageSteps.ts';
import { readSheet, type ReadSheet } from './qrSheetReader.ts';

interface Download {
  readonly fileName: string;
  readonly sheet: Blob;
}

const downloads: Download[] = [];
const sheets = new Map<string, Blob>();

// jsdom has neither object URLs nor downloads: the test keeps each file the page hands to the browser.
beforeEach(() => {
  downloads.length = 0;
  URL.createObjectURL = (sheet: Blob) => {
    const url = `blob:sheet-${sheets.size}`;
    sheets.set(url, sheet);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ fileName: this.download, sheet: sheets.get(this.getAttribute('href') ?? '') as Blob });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function entreeRoyOf(api: FakeApiState): FakeGate {
  const gate = api.gates.get(garageRoy.id)?.find(({ id }) => id === ENTREE_ROY_ID);
  if (gate === undefined) {
    throw new Error('Garage Roy has lost Entrée Roy');
  }
  return gate;
}

async function printQrOf(gateName: string): Promise<ReadSheet> {
  const count = downloads.length;
  await userEvent.click(within(gateItemOf(gateName)).getByRole('button', { name: `Imprimer le QR de ${gateName}` }));
  await waitFor(() => expect(downloads).toHaveLength(count + 1));
  return readSheet(downloads.at(-1)?.sheet as Blob);
}

describe('the printable QR of a gate', () => {
  it('downloads a sheet whose QR a phone reads as the gate’s signed link', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);

    const sheet = await printQrOf('Entrée Roy');

    expect(downloads.at(-1)?.fileName).toBe('qr-entree-roy.html');
    expect(sheet.scanned).toBe(qrLinkOf(entreeRoyOf(api)));
    expect(await screen.findByText('QR de Entrée Roy téléchargé. Ouvrez le fichier et imprimez-le.')).toBeDefined();
    expect(api.requests).toContain(`GET /lots/${garageRoy.id}/gates/${ENTREE_ROY_ID}/qr-link`);
  });

  it('prints the lot, the gate and its direction French first, then English, with the link spelled out', async () => {
    await openGatesOf(pierre, garageRoy.id);

    const { document: sheet, scanned } = await printQrOf('Entrée Roy');

    expect(sheet.documentElement.lang).toBe('fr');
    expect(sheet.querySelector('h1')?.textContent).toBe('Entrée Roy');
    expect(sheet.querySelector('.eyebrow')?.textContent).toBe('Garage Roy');
    expect([...sheet.querySelectorAll('.scan')].map((line) => line.textContent)).toEqual(['Scannez avec l’app Palier', 'Scan with the Palier app']);
    expect(sheet.body.textContent).toContain('Entrée · Entry');
    expect(sheet.querySelector('.link')?.textContent).toBe(scanned);
    expect(sheet.querySelector('style')?.textContent).toMatch(/\.qr \{[^}]*width: 80mm/);
  });

  it('carries its two faces inside the file, so it prints in Archivo and IBM Plex Mono offline', async () => {
    await openGatesOf(pierre, garageRoy.id);

    const { document: sheet } = await printQrOf('Entrée Roy');

    const style = sheet.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/font-family: Archivo; font-weight: 600; src: url\(data:font\/woff;base64,[A-Za-z0-9+/=]{1000,}\)/);
    expect(style).toMatch(/font-family: 'IBM Plex Mono'; font-weight: 500; src: url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{1000,}\)/);
    expect(style).not.toMatch(/url\((?!data:)/);
  });

  it('prints a gate named like a script as text, running nothing', async () => {
    await openGatesOf(pierre, garageRoy.id);
    await addGate({ name: '<script>alert(1)</script>' });

    const { document: sheet } = await printQrOf('<script>alert(1)</script>');

    expect(sheet.querySelectorAll('script')).toHaveLength(0);
    expect(sheet.querySelector('h1')?.textContent).toBe('<script>alert(1)</script>');
    expect(sheet.title).toBe('<script>alert(1)</script> — Garage Roy');
    expect(downloads.at(-1)?.fileName).toBe('qr-script-alert-1-script.html');
  });
});

describe('regenerating the QR secret', () => {
  it('asks first, then prints a new QR signed with the new secret, the old one no longer matching', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);
    const printed = (await printQrOf('Entrée Roy')).scanned;
    const item = () => within(gateItemOf('Entrée Roy'));

    await userEvent.click(item().getByRole('button', { name: 'Régénérer le secret du QR de Entrée Roy' }));
    expect(item().getByText('Régénérer le secret du QR ? Les QR imprimés ne fonctionneront plus.')).toBeDefined();
    await userEvent.click(item().getByRole('button', { name: 'Régénérer le secret du QR de Entrée Roy' }));

    expect(await screen.findByText('Nouveau secret enregistré. Imprimez le nouveau QR de Entrée Roy.')).toBeDefined();
    const reprinted = (await printQrOf('Entrée Roy')).scanned;
    expect(reprinted).not.toBe(printed);
    expect(reprinted).toBe(qrLinkOf(entreeRoyOf(api)));
    expect(api.requests.filter((request) => request.endsWith('/qr-secret'))).toEqual([`POST /lots/${garageRoy.id}/gates/${ENTREE_ROY_ID}/qr-secret`]);
  });

  it('leaves the secret as it was when the question is cancelled with Escape', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);
    const before = entreeRoyOf(api).qrSecret;

    await userEvent.click(within(gateItemOf('Entrée Roy')).getByRole('button', { name: 'Régénérer le secret du QR de Entrée Roy' }));
    await userEvent.keyboard('{Escape}');

    expect(entreeRoyOf(api).qrSecret).toBe(before);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Régénérer le secret du QR de Entrée Roy');
  });
});

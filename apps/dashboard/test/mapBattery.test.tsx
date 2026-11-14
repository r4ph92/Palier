import type { DashboardMapAisle } from '@palier/shared-types';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { parkingDemoMap } from './fakeMapData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { renderDashboard } from './renderDashboard.tsx';

const MAP_PATH = `/lots/${parkingDemo.id}/map`;
const AISLE_A = parkingDemoMap.levels[0]?.aisles[0] as DashboardMapAisle;
const BATTERY_REQUEST = `PUT /lots/${parkingDemo.id}/aisles/${AISLE_A.id}/beacon-battery`;
const WHITESPACE = /\s+/g;

function beaconRow(aisleName: string): HTMLElement {
  const beacons = within(screen.getByRole('region', { name: /^(Balises|Beacons)$/ }));
  return beacons.getByRole('rowheader', { name: aisleName }).closest('tr') as HTMLElement;
}

// The battery column, third cell after the level and the minor; French percents hold a narrow no-break space ("15 %"), compared here as a plain space.
function batteryOf(aisleName: string): string {
  return (within(beaconRow(aisleName)).getAllByRole('cell').at(2)?.textContent ?? '').replace(WHITESPACE, ' ').trim();
}

function toneOf(aisleName: string): string | undefined {
  return [...(beaconRow(aisleName).querySelector('.state-mark-square')?.classList ?? [])].find((name) => name !== 'state-mark-square');
}

async function openMap(): Promise<FakeApiState> {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path: MAP_PATH });
  await screen.findByRole('heading', { level: 1, name: 'Plan et balises — Parking Démo' });
  return api;
}

async function recordBattery(aisleName: string, percent: string): Promise<void> {
  const row = within(beaconRow(aisleName));
  if (percent !== '') {
    await userEvent.type(row.getByRole('textbox', { name: `Pile de la balise ${aisleName}, en pourcentage` }), percent);
  }
  await userEvent.click(row.getByRole('button', { name: `Enregistrer la pile de la balise ${aisleName}` }));
}

describe('the beacon batteries on the map', () => {
  it('shows every beacon’s battery unknown before any reading, with a hollow warning square', async () => {
    await openMap();

    expect(['A', 'B', 'Voie de sortie'].map(batteryOf)).toEqual(['Pile inconnue', 'Pile inconnue', 'Pile inconnue']);
    expect(toneOf('A')).toBe('state-mark-warning');
  });

  it('records 15 % for aisle A’s beacon and shows it low, in red, without reloading the map', async () => {
    const api = await openMap();

    await recordBattery('A', '15');

    expect(await screen.findByText(/^Pile de la balise A enregistrée/)).toBeDefined();
    expect(batteryOf('A')).toBe('Pile faible · 15 %');
    expect(toneOf('A')).toBe('state-mark-danger');
    expect(api.requests.filter((request) => request === BATTERY_REQUEST)).toHaveLength(1);
    expect(api.requests.filter((request) => request === `GET /lots/${parkingDemo.id}/map`)).toHaveLength(1);
    expect(within(beaconRow('A')).getByRole('textbox')).toHaveProperty('value', '');
  });

  it('reads a percent typed with its sign, and shows a healthy battery OK', async () => {
    await openMap();

    await recordBattery('Voie de sortie', '80 %');

    await screen.findByText(/^Pile de la balise Voie de sortie enregistrée/);
    expect(batteryOf('Voie de sortie')).toBe('Pile OK · 80 %');
    expect(toneOf('Voie de sortie')).toBe('state-mark-free');
  });

  it.each(['101', '-1', '1,5', ''])('refuses %p beside the field and sends nothing', async (percent) => {
    const api = await openMap();

    await recordBattery('A', percent);

    expect(within(beaconRow('A')).getByText('Entrez un pourcentage entier de 0 à 100.')).toBeDefined();
    expect(within(beaconRow('A')).getByRole('textbox')).toHaveProperty('ariaInvalid', 'true');
    expect(api.requests.filter((request) => request === BATTERY_REQUEST)).toHaveLength(0);
  });

  it('says the aisle is gone when the API no longer finds it', async () => {
    const api = await openMap();
    api.answers.set(BATTERY_REQUEST, { status: 404, body: { statusCode: 404, error: 'AISLE_NOT_FOUND', message: 'AISLE_NOT_FOUND' } });

    await recordBattery('A', '15');

    expect(await within(beaconRow('A')).findByRole('alert')).toHaveProperty('textContent', 'Cette allée est introuvable. Rechargez le plan.');
    expect(batteryOf('A')).toBe('Pile inconnue');
  });

  it('outlines every row’s button, so the level form keeps the one filled button', async () => {
    await openMap();

    expect(within(beaconRow('A')).getByRole('button').className).toBe('secondary-button');
  });

  it('reads Low battery and Unknown battery in English, with no French left', async () => {
    await openMap();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    const row = within(beaconRow('A'));
    await userEvent.type(row.getByRole('textbox', { name: 'Battery of beacon A, in percent' }), '15');

    await userEvent.click(row.getByRole('button', { name: 'Save the battery of beacon A' }));

    expect(await screen.findByText('Battery of beacon A saved: 15%.')).toBeDefined();
    expect(batteryOf('A')).toBe('Low battery · 15%');
    expect(batteryOf('B')).toBe('Unknown battery');
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });
});

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { entreeDemo, equipmentOf, sortieDemo } from './fakeEquipmentData.ts';
import { renderDashboard } from './renderDashboard.tsx';

const POLL_MILLISECONDS = 30_000;
const EQUIPMENT_PATH = `/lots/${parkingDemo.id}/equipment`;
const WHITESPACE = /\s+/g;

function presenceRowOf(gateName: string): HTMLElement {
  return screen.getByRole('rowheader', { name: gateName }).closest('tr') as HTMLElement;
}

function presenceOf(gateName: string): string {
  return (presenceRowOf(gateName).querySelector('.gate-presence')?.textContent ?? '').replace(WHITESPACE, ' ').trim();
}

function figureOf(gateName: string): string {
  return presenceRowOf(gateName).querySelector('.gate-presence .no-break')?.textContent ?? '';
}

describe('QA #77: the average presence time on the equipment page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rounds a raw 9.05 s half up, "9,1 s" in French and "9.1 s" in English', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([entreeDemo, { ...sortieDemo, averagePresenceSeconds: 9.05 }]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Sortie Démo' });

    expect(presenceOf('Sortie Démo')).toBe('Temps de présence moyen (7 jours) : 9,1 s');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { level: 1, name: 'Equipment — Parking Démo' });
    expect(presenceOf('Sortie Démo')).toBe('Average presence time (7 days): 9.1 s');
  });

  it('keeps a long average whole, its thousands separators never a plain space the line could break at', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([{ ...entreeDemo, averagePresenceSeconds: 12_345.67 }, sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    expect(presenceOf('Entrée Démo')).toBe('Temps de présence moyen (7 jours) : 12 345,7 s');
    expect(figureOf('Entrée Démo')).not.toContain(' ');
  });

  it('shows a zero-second average as "0,0 s", not as no measured passage', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([{ ...entreeDemo, averagePresenceSeconds: 0 }, sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    expect(presenceOf('Entrée Démo')).toBe('Temps de présence moyen (7 jours) : 0,0 s');
  });

  it('shows a newly measured passage within one poll, without reloading the page', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([entreeDemo, sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });
    expect(presenceOf('Entrée Démo')).toBe('Temps de présence moyen (7 jours) : aucun passage mesuré');

    api.equipment.set(parkingDemo.id, equipmentOf([{ ...entreeDemo, averagePresenceSeconds: 9.034 }, sortieDemo]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MILLISECONDS);
    });

    await vi.waitFor(() => expect(presenceOf('Entrée Démo')).toBe('Temps de présence moyen (7 jours) : 9,0 s'));
  });

  it('lets the no-passage line wrap: nothing in it is kept whole', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([entreeDemo, sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    expect(presenceRowOf('Entrée Démo').querySelector('.gate-presence .no-break')).toBeNull();
  });

  it('sets a measured figure in the figure style', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.equipment.set(parkingDemo.id, equipmentOf([{ ...entreeDemo, averagePresenceSeconds: 9 }, sortieDemo]));
    renderDashboard({ path: EQUIPMENT_PATH });
    await screen.findByRole('rowheader', { name: 'Entrée Démo' });

    const figure = presenceRowOf('Entrée Démo').querySelector('.gate-presence .figure.no-break');
    expect(figure?.textContent?.replace(WHITESPACE, ' ')).toBe('9,0 s');
  });
});

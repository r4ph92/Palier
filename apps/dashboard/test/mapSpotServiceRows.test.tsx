import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parkingDemo } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { parkingDemoAisleA, rowOf } from './mapSpotSteps.ts';

function spotA1(api: FakeApiState) {
  const spot = api.spots.get(parkingDemo.id)?.find(({ number }) => number === 'A-1');
  if (spot === undefined) {
    throw new Error('Parking Démo has no A-1 in the fake.');
  }
  return spot;
}

function shownIn(row: HTMLElement, label: string): HTMLElement[] {
  return within(row).queryAllByText(label).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

describe('the service button on its row', () => {
  it('shows Mise hors service… on the clicked row only, and marks the table busy', async () => {
    const api = await parkingDemoAisleA();
    api.answers.set(`PUT /lots/${parkingDemo.id}/spots/${spotA1(api).id}/service`, 'pending');

    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));

    expect(shownIn(rowOf('A-1'), 'Mise hors service…')).toHaveLength(1);
    expect(shownIn(rowOf('A-2'), 'Mise hors service…')).toHaveLength(0);
    expect(rowOf('A-1').closest('table')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows Remise en service… while a spot comes back', async () => {
    const api = await parkingDemoAisleA();
    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));
    await screen.findByRole('button', { name: 'Remettre en service A-1' });
    api.answers.set(`PUT /lots/${parkingDemo.id}/spots/${spotA1(api).id}/service`, 'pending');

    await userEvent.click(screen.getByRole('button', { name: 'Remettre en service A-1' }));

    expect(shownIn(rowOf('A-1'), 'Remise en service…')).toHaveLength(1);
  });

  it('says in the row of A-1 that it is in use, focuses the message, and reads the list again', async () => {
    const api = await parkingDemoAisleA();
    Object.assign(spotA1(api), { state: 'ASSIGNED' });

    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));

    const alert = await within(rowOf('A-1')).findByRole('alert');
    expect(alert.textContent).toMatch(/A-1\.$/u);
    expect(document.activeElement).toBe(alert);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(rowOf('A-1')).getByText('Attribuée')).toBeDefined();
  });
});

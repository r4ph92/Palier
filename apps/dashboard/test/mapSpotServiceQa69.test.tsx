import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parkingDemo } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { parkingDemoAisleA } from './mapSpotSteps.ts';

function spotA1(api: FakeApiState) {
  const spot = api.spots.get(parkingDemo.id)?.find(({ number }) => number === 'A-1');
  if (spot === undefined) {
    throw new Error('Parking Démo has no A-1 in the fake.');
  }
  return spot;
}

function serviceRequestOf(spotId: string): string {
  return `PUT /lots/${parkingDemo.id}/spots/${spotId}/service`;
}

describe('taking a spot out of service under attack (QA #69)', () => {
  it('sends one request when Mettre hors service is clicked again while the first is on its way', async () => {
    const api = await parkingDemoAisleA();
    const request = serviceRequestOf(spotA1(api).id);
    api.answers.set(request, 'pending');
    const button = screen.getByRole('button', { name: 'Mettre hors service A-1' });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(api.requests.filter((sent) => sent === request)).toHaveLength(1);
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('reloads the list when A-1 was deleted in another tab, instead of showing it out of service', async () => {
    const api = await parkingDemoAisleA();
    const spots = api.spots.get(parkingDemo.id) ?? [];
    spots.splice(spots.indexOf(spotA1(api)), 1);

    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));

    expect((await screen.findByRole('alert')).textContent).toContain('rechargée');
    expect(screen.queryByRole('rowheader', { name: 'A-1' })).toBeNull();
  });

  it('refuses putting back A-1 once another tab put it back and a driver was assigned it', async () => {
    const api = await parkingDemoAisleA();
    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));
    await screen.findByRole('button', { name: 'Remettre en service A-1' });
    Object.assign(spotA1(api), { state: 'ASSIGNED' });

    await userEvent.click(screen.getByRole('button', { name: 'Remettre en service A-1' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/^Place utilisée — réessayez après la sortie\s:\sA-1\.$/u);
    expect(spotA1(api).state).toBe('ASSIGNED');
  });
});

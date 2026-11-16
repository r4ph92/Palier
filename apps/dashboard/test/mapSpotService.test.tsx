import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parkingDemo } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { parkingDemoAisleA, rowOf } from './mapSpotSteps.ts';

describe('taking a spot out of service and back', () => {
  it('shows A-1 out of service, says so, and keeps focus on the button that now reads Remettre en service', async () => {
    const api = await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));

    expect(await screen.findByText('Place A-1 mise hors service.')).toBeDefined();
    expect(within(rowOf('A-1')).getByText('Hors service')).toBeDefined();
    expect(api.spots.get(parkingDemo.id)?.find(({ number }) => number === 'A-1')?.state).toBe('OUT_OF_SERVICE');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remettre en service A-1' }));
  });

  it('puts it back as free', async () => {
    const api = await parkingDemoAisleA();
    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-1' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remettre en service A-1' }));

    expect(await screen.findByText('Place A-1 remise en service.')).toBeDefined();
    expect(within(rowOf('A-1')).queryByText('Hors service')).toBeNull();
    expect(api.spots.get(parkingDemo.id)?.find(({ number }) => number === 'A-1')?.state).toBe('AVAILABLE');
  });

  it('refuses an occupied spot with the in-use message and changes nothing', async () => {
    const api = await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors service A-3' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Place utilisée — réessayez après la sortie : A-3.');
    expect(api.spots.get(parkingDemo.id)?.find(({ number }) => number === 'A-3')?.state).toBe('OCCUPIED');
    expect(within(rowOf('A-3')).queryByText('Hors service')).toBeNull();
  });

  it('reads Take out of service on an English page, with no French left', async () => {
    await parkingDemoAisleA();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('button', { name: 'Take out of service A-1' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Take out of service A-/u })).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Take out of service A-1' }));
    expect(await screen.findByText('Spot A-1 taken out of service.')).toBeDefined();
    expect(within(screen.getByRole('button', { name: 'Put back in service A-1' })).getAllByText('Put back in service')[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });
});

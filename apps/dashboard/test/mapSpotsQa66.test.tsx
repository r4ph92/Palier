import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parkingDemo } from './fakeDashboardApi.ts';
import { addSpots, garageRoyAisleA, parkingDemoAisleA, spotNumbers } from './mapSpotSteps.ts';

describe('the spots of an aisle under attack (QA #66)', () => {
  it('reads « A-1 a A-20 », typed without the accent, as A-1 to A-20 instead of adding one spot named « A-1 a A-20 »', async () => {
    await garageRoyAisleA();

    await addSpots('A-1 a A-20');

    await screen.findByText('20 places ajoutées à l’allée A.');
    expect(spotNumbers()).not.toContain('A-1 a A-20');
  });

  it('says what was just added in English once the page switches to English', async () => {
    await garageRoyAisleA();
    await addSpots('A-1 à A-3');
    await screen.findByText('3 places ajoutées à l’allée A.');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByText('3 spots added to aisle A.')).toBeDefined();
    expect(screen.queryByText('3 places ajoutées à l’allée A.')).toBeNull();
  });

  it('closes the edit form of a spot found gone, once the list is read again without it', async () => {
    const api = await parkingDemoAisleA();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier A-1' }));
    api.spots.get(parkingDemo.id)?.shift();

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la place' }));

    await screen.findByText('Cette place est introuvable. La liste des places a été rechargée.');
    await waitFor(() => expect(spotNumbers()).toEqual(['A-2', 'A-3']));
    expect(screen.queryByRole('form', { name: 'Modifier la place A-1' })).toBeNull();
  });
});

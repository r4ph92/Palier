import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy } from './fakeDashboardApi.ts';
import { addForm, addSpots, garageRoyAisleA, parkingDemoAisleA, rowOf, spotNumbers, spotsRegion } from './mapSpotSteps.ts';

describe('the spots of an aisle', () => {
  it('adds A-1 to A-20 to aisle A in one action and lists them in order', async () => {
    const api = await garageRoyAisleA();

    await addSpots('A-1 à A-20');

    expect((await screen.findByText('20 places ajoutées à l’allée A.')).closest('[role="status"]')).not.toBeNull();
    expect(spotNumbers()).toEqual(Array.from({ length: 20 }, (_, index) => `A-${index + 1}`));
    expect(within(rowOf('A-7')).getByText('Aucun')).toBeDefined();
    expect(rowOf('A-7').textContent).toMatch(/30\sm/);
    expect(api.requests).toContain(`POST /lots/${garageRoy.id}/aisles/${api.maps.get(garageRoy.id)?.levels[0]?.aisles[0]?.id}/spots`);
    expect(addForm().getByRole('textbox', { name: 'Numéros des places' })).toHaveProperty('value', '');
  });

  it('applies the ticked attributes and the distance to every spot added', async () => {
    await garageRoyAisleA();

    await userEvent.click(addForm().getByRole('checkbox', { name: 'Électrique' }));
    await userEvent.click(addForm().getByRole('checkbox', { name: 'Gabarit large' }));
    await addSpots('B-1 à B-2', '12');

    await screen.findByText('2 places ajoutées à l’allée A.');
    expect(rowOf('B-2').textContent).toContain('Électrique, Gabarit large');
    expect(rowOf('B-2').textContent).toMatch(/12\sm/);
  });

  it('warns, without refusing, that the lot now has more spots than its capacity', async () => {
    await garageRoyAisleA();
    expect(screen.queryByText(/Plus de places enregistrées/)).toBeNull();

    await addSpots('A-1');

    expect(await screen.findByText('Plus de places enregistrées (1) que la capacité du stationnement (0).')).toBeDefined();
  });

  it('says beside the numbers which one is already taken in the lot, and adds none of the range', async () => {
    await garageRoyAisleA();
    await addSpots('A-1 à A-3');
    await screen.findByText('3 places ajoutées à l’allée A.');

    await addSpots('a-2 à a-4');

    const rangeBox = addForm().getByRole('textbox', { name: 'Numéros des places' });
    expect(await screen.findByText('Ce numéro existe déjà dans ce parking : A-2.')).toBeDefined();
    expect(rangeBox.getAttribute('aria-invalid')).toBe('true');
    expect(spotNumbers()).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it.each([
    ['A-1 à B-3', 'Numéros des places'],
    ['A-1 à A-201', 'Numéros des places'],
  ])('refuses %s beside its field and sends nothing', async (range, label) => {
    const api = await garageRoyAisleA();

    await addSpots(range);

    expect(addForm().getByRole('textbox', { name: label }).getAttribute('aria-invalid')).toBe('true');
    expect(api.requests.some((request) => request.startsWith('POST') && request.endsWith('/spots'))).toBe(false);
  });

  it.each(['A-1 - A-20', 'A-1-A-20', 'A 7'])('says beside the field that « %s » cannot be read, and sends nothing', async (range) => {
    const api = await garageRoyAisleA();

    await addSpots(range);

    const rangeBox = addForm().getByRole('textbox', { name: 'Numéros des places' });
    expect(document.getElementById(`${rangeBox.id}-error`)?.textContent).toBe('Numéros illisibles. Écrivez une plage comme A-1 à A-20, ou un seul numéro comme A-7.');
    expect(api.requests.some((request) => request.startsWith('POST') && request.endsWith('/spots'))).toBe(false);
  });

  it('refuses a distance in decimals beside its field', async () => {
    await garageRoyAisleA();

    await addSpots('A-1', '1,5');

    const distanceBox = addForm().getByRole('textbox', { name: 'Distance de la sortie, en mètres' });
    expect(distanceBox.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(`${distanceBox.id}-error`)?.textContent?.replace(/\s/g, ' ')).toBe('Entrez un nombre entier de mètres, de 0 à 2 000.');
  });

  it('offers every parking aisle of every level, never the exit lane', async () => {
    await parkingDemoAisleA();

    const options = within(spotsRegion().getByRole('combobox', { name: 'Allée affichée' })).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual(['P1 · allée A', 'P1 · allée B']);
  });

  it('edits one spot from its row, then gives focus back to its edit button', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Modifier A-1' }));
    const form = within(screen.getByRole('form', { name: 'Modifier la place A-1' }));
    expect(document.activeElement?.textContent).toBe('Modifier la place A-1');
    expect(form.getByRole('checkbox', { name: 'Électrique' })).toHaveProperty('checked', true);
    await userEvent.click(form.getByRole('checkbox', { name: 'Accessible' }));
    await userEvent.clear(form.getByRole('textbox', { name: 'Distance de la sortie, en mètres' }));
    await userEvent.type(form.getByRole('textbox', { name: 'Distance de la sortie, en mètres' }), '12');
    await userEvent.click(form.getByRole('button', { name: 'Enregistrer la place' }));

    expect(await screen.findByText('Place A-1 enregistrée.')).toBeDefined();
    expect(rowOf('A-1').textContent).toContain('Électrique, Accessible');
    expect(rowOf('A-1').textContent).toMatch(/12\sm/);
    expect(screen.queryByRole('form', { name: 'Modifier la place A-1' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Modifier A-1' }));
  });
});

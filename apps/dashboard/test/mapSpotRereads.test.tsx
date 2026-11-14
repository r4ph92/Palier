import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { refused } from './fakeDashboardData.ts';
import { parkingDemoMap } from './fakeMapData.ts';
import { longAisleSpots, PARKING_DEMO_AISLE_A } from './fakeSpotData.ts';
import { addSpots, nextPageButton, PARKING_DEMO_MAP, parkingDemoAisleA, rowOf, spotNumbers, spotsRegion } from './mapSpotSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

const AISLE_A_SPOTS = `GET /lots/${parkingDemo.id}/aisles/${PARKING_DEMO_AISLE_A}/spots`;
const MAP_READ = `GET /lots/${parkingDemo.id}/map`;
const deleteRequestOf = (spotId: string) => `DELETE /lots/${parkingDemo.id}/spots/${spotId}`;

async function confirmDelete(number: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: `Supprimer ${number}` }));
  await userEvent.click(screen.getByRole('button', { name: `Confirmer la suppression de ${number}` }));
}

describe('reading the page again after a refused spot change', () => {
  it('reads the list again when the lot is busy, then says so', async () => {
    const api = await parkingDemoAisleA();
    api.answers.set(deleteRequestOf(api.spots.get(parkingDemo.id)?.[0]?.id ?? ''), refused(503, 'LOT_BUSY'));

    await confirmDelete('A-1');

    expect(await screen.findByRole('alert')).toBeDefined();
    await waitFor(() => expect(api.requests.filter((request) => request === AISLE_A_SPOTS)).toHaveLength(2));
    expect(spotNumbers()).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('says the page could not be reloaded when the list read fails too', async () => {
    const api = await parkingDemoAisleA();
    api.answers.set(deleteRequestOf(api.spots.get(parkingDemo.id)?.[0]?.id ?? ''), refused(503, 'LOT_BUSY'));
    api.answers.set(AISLE_A_SPOTS, { status: 500 });

    await confirmDelete('A-1');

    expect((await screen.findByRole('alert')).textContent).toBe('La page n’a pas pu être rechargée après ce refus. Rechargez la page avant de recommencer.');
  });

  it('reads the map again when the aisle is gone, and moves to the aisle that remains', async () => {
    const api = await parkingDemoAisleA();
    const levels = parkingDemoMap.levels.map((level) => ({ ...level, aisles: level.aisles.filter(({ id }) => id !== PARKING_DEMO_AISLE_A) }));
    api.maps.set(parkingDemo.id, { ...parkingDemoMap, levels });

    await addSpots('A-9');

    await waitFor(() => expect(api.requests.filter((request) => request === MAP_READ)).toHaveLength(2));
    const options = within(spotsRegion().getByRole('combobox', { name: 'Allée affichée' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['P1 · allée B']);
  });
});

describe('editing a spot that was deleted meanwhile', () => {
  async function saveEditOfGoneSpot(api: Awaited<ReturnType<typeof parkingDemoAisleA>>): Promise<void> {
    api.answers.set(`PUT /lots/${parkingDemo.id}/spots/${api.spots.get(parkingDemo.id)?.[0]?.id ?? ''}`, refused(404, 'SPOT_NOT_FOUND'));
    await userEvent.click(screen.getByRole('button', { name: 'Modifier A-1' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Modifier la place A-1' })).getByRole('button', { name: 'Enregistrer la place' }));
  }

  it('closes the form and says the list was reloaded once the list is read again', async () => {
    await saveEditOfGoneSpot(await parkingDemoAisleA());

    expect((await screen.findByRole('alert')).textContent).toContain('rechargée');
    expect(screen.queryByRole('form', { name: 'Modifier la place A-1' })).toBeNull();
  });

  it('says the page could not be reloaded when the list read fails, SPOT_RELOAD_FAILED', async () => {
    const api = await parkingDemoAisleA();
    api.answers.set(AISLE_A_SPOTS, { status: 500 });

    await saveEditOfGoneSpot(api);

    expect((await screen.findByRole('alert')).textContent).toBe('La page n’a pas pu être rechargée après ce refus. Rechargez la page avant de recommencer.');
    expect(screen.queryByRole('form', { name: 'Modifier la place A-1' })).toBeNull();
  });
});

describe('the spot table', () => {
  it('is named by its title and marks each state with a square', async () => {
    await parkingDemoAisleA();

    const table = screen.getByRole('table', { name: 'Allée A — 3 places enregistrées' });

    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(rowOf('A-3').querySelector('.state-mark-muted')?.nextElementSibling?.textContent).toBe('Occupée');
    expect(rowOf('A-1').querySelector('.state-mark-free')?.nextElementSibling?.textContent).toBe('Libre');
  });

  it('opens the edit form right after its row, and Escape closes it back to the edit button', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Modifier A-1' }));

    expect(rowOf('A-1').nextElementSibling?.querySelector('form')?.getAttribute('aria-labelledby')).toBe('edit-spot-title');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('form', { name: 'Modifier la place A-1' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Modifier A-1' }));
  });

  it('closes the delete question on Escape', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer A-2' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Supprimer A-2 ?')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Supprimer A-2' }));
  });

  it('shows a long aisle 50 rows at a time', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spots.set(parkingDemo.id, longAisleSpots(120));
    renderDashboard({ path: PARKING_DEMO_MAP });
    await screen.findByRole('rowheader', { name: 'B-1' });

    expect(spotNumbers()).toHaveLength(50);
    expect(screen.getByText('1–50 sur 120')).toBeDefined();
    await userEvent.click(nextPageButton());
    await userEvent.click(nextPageButton());

    expect(screen.getByText('101–120 sur 120')).toBeDefined();
    expect(spotNumbers()[0]).toBe('B-101');
    expect(nextPageButton().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('the page turns of a long spot list', () => {
  it('repeats under the table, with its own landmark name', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spots.set(parkingDemo.id, longAisleSpots(120));
    renderDashboard({ path: PARKING_DEMO_MAP });
    await screen.findByRole('rowheader', { name: 'B-1' });

    expect(screen.getByRole('navigation', { name: 'Pages de la liste des places' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Pages de la liste des places, sous le tableau' })).toBeDefined();
  });

  it('does not bring back a page remembered before the list got shorter', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.spots.set(parkingDemo.id, longAisleSpots(101));
    renderDashboard({ path: PARKING_DEMO_MAP });
    await screen.findByRole('rowheader', { name: 'B-1' });
    await userEvent.click(nextPageButton());
    await userEvent.click(nextPageButton());
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer B-101' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression de B-101' }));
    await screen.findByText('Place B-101 supprimée.');
    expect(screen.getByText('51–100 sur 100')).toBeDefined();

    await addSpots('B-101 à B-110');

    await screen.findByText('10 places ajoutées à l’allée A.');
    expect(screen.getByText('101–110 sur 110')).toBeDefined();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { parkingDemoMap } from './fakeMapData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { PARKING_DEMO_MAP, parkingDemoAisleA, rowOf, spotNumbers, spotsRegion } from './mapSpotSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

const AISLE_A_SPOTS = `GET /lots/${parkingDemo.id}/aisles/${parkingDemoMap.levels[0]?.aisles[0]?.id}/spots`;

describe('deleting a spot', () => {
  it('asks in the row, with focus on the confirm button, and gives focus back to delete on cancel', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer A-1' }));

    expect(within(rowOf('A-1')).getByText((_text, element) => element?.textContent === 'Supprimer A-1 ?')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirmer la suppression de A-1' }));
    await userEvent.click(within(rowOf('A-1')).getByRole('button', { name: 'Annuler' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Supprimer A-1' }));
  });

  it('removes a free spot from the list, says so, and moves focus to the list title', async () => {
    const api = await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer A-1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression de A-1' }));

    expect(await screen.findByText('Place A-1 supprimée.')).toBeDefined();
    expect(spotNumbers()).toEqual(['A-2', 'A-3']);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Allée A — 2\u00a0places enregistrées' }));
    expect(api.spots.get(parkingDemo.id)?.map(({ number }) => number)).toEqual(['A-2', 'A-3']);
  });

  it('refuses an occupied spot and keeps it in the list', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer A-3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression de A-3' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Place utilisée — réessayez après la sortie\u00a0: A-3.');
    expect(spotNumbers()).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('reads the list again when the spot is already gone', async () => {
    const api = await parkingDemoAisleA();
    api.spots.get(parkingDemo.id)?.shift();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer A-1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression de A-1' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Cette place est introuvable. La liste des places a été rechargée.');
    await waitFor(() => expect(spotNumbers()).toEqual(['A-2', 'A-3']));
    expect(api.requests.filter((request) => request === AISLE_A_SPOTS)).toHaveLength(2);
  });
});

describe('reading the spots of an aisle', () => {
  it('shows the list as unavailable with a retry, then lists it', async () => {
    const api = installFakeApi({ signedInAs: sophie, answers: { [AISLE_A_SPOTS]: { status: 500 } } });
    renderDashboard({ path: PARKING_DEMO_MAP });

    const retry = await findSpotsRetry();
    api.answers.delete(AISLE_A_SPOTS);
    await userEvent.click(retry);

    expect(await screen.findByRole('rowheader', { name: 'A-1' })).toBeDefined();
  });

  it('switches to aisle B, which has no spot yet', async () => {
    await parkingDemoAisleA();

    await userEvent.selectOptions(spotsRegion().getByRole('combobox', { name: 'Allée affichée' }), 'P1 · allée B');

    expect(await screen.findByText('Aucune place dans cette allée. Ajoutez-en avec le formulaire ci-dessus.')).toBeDefined();
    expect(spotsRegion().getByRole('heading', { level: 3, name: 'Allée B — 0\u00a0place enregistrée' })).toBeDefined();
  });

  it('shows the spots, their attributes and their forms entirely in English', async () => {
    await parkingDemoAisleA();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit A-2' }));

    const attributes = ['A-1', 'A-2', 'A-3'].map((number) => rowOf(number).children[1]?.textContent);
    expect(attributes).toEqual(['Electric', 'Accessible', 'Oversize']);
    expect(screen.getByRole('form', { name: 'Edit spot A-2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add the spots' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });
});

async function findSpotsRetry(): Promise<HTMLElement> {
  return within(await screen.findByRole('region', { name: 'Places' })).findByRole('button', { name: 'Réessayer' });
}

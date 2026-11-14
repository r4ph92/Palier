import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { longAisleSpots } from './fakeSpotData.ts';
import { addSpots, nextPageButton, PARKING_DEMO_MAP, spotNumbers } from './mapSpotSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

async function aisleOf(count: number): Promise<void> {
  const api = installFakeApi({ signedInAs: sophie });
  api.spots.set(parkingDemo.id, longAisleSpots(count));
  renderDashboard({ path: PARKING_DEMO_MAP });
  await screen.findByRole('rowheader', { name: 'B-1' });
}

describe('the pages of a spot list under attack, round 2 (QA #66)', () => {
  it('shows exactly 50 spots on one page, without page turns', async () => {
    await aisleOf(50);

    expect(spotNumbers()).toHaveLength(50);
    expect(screen.queryByRole('button', { name: 'Suivantes' })).toBeNull();
  });

  it('shows the 51st spot alone on page 2, then returns to one page once it is deleted', async () => {
    await aisleOf(51);
    expect(screen.getByText('1–50 sur 51')).toBeDefined();
    await userEvent.click(nextPageButton());
    expect(spotNumbers()).toEqual(['B-51']);

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer B-51' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression de B-51' }));

    await screen.findByText('Place B-51 supprimée.');
    expect(spotNumbers()).toHaveLength(50);
    expect(screen.queryByRole('button', { name: 'Suivantes' })).toBeNull();
  });

  // Live (Chrome): turning to the last page disables the focused « Suivantes » and focus falls to the page body.
  it('keeps keyboard focus on an enabled control after turning to the last page', async () => {
    await aisleOf(51);

    await userEvent.click(nextPageButton());

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).not.toHaveProperty('disabled', true);
  });

  // Live: on page 5 of aisle B, adding « AA 1 à AA 2 » said « 2 places ajoutées » but both spots were on page 1, out of sight.
  it('shows the spots just added even when the list was turned to another page', async () => {
    await aisleOf(120);
    await userEvent.click(nextPageButton());
    expect(screen.getByText('51–100 sur 120')).toBeDefined();

    await addSpots('B-121');

    await screen.findByText('1 place ajoutée à l’allée A.');
    await waitFor(() => expect(spotNumbers()).toContain('B-121'));
  });
});

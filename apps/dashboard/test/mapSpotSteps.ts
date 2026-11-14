import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { addAisle, addLevel, openGarageRoyMap } from './mapPageSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

export const PARKING_DEMO_MAP = `/lots/${parkingDemo.id}/map`;

export function spotsRegion() {
  return within(screen.getByRole('region', { name: 'Places' }));
}

export function addForm() {
  return within(screen.getByRole('form', { name: 'Ajouter des places' }));
}

// Garage Roy with level P1 and aisle A, whose spot list is empty.
export async function garageRoyAisleA(): Promise<FakeApiState> {
  const api = await openGarageRoyMap();
  await addLevel('P1');
  await addAisle({ code: 'A', minor: '1' });
  await screen.findByText('Aucune place dans cette allée.');
  return api;
}

// Sophie on Parking Démo, aisle A listing A-1 electric, A-2 accessible and A-3 oversize and occupied.
export async function parkingDemoAisleA(): Promise<FakeApiState> {
  const api = installFakeApi({ signedInAs: sophie });
  renderDashboard({ path: PARKING_DEMO_MAP });
  await screen.findByRole('rowheader', { name: 'A-3' });
  return api;
}

export async function addSpots(range: string, distance = '30'): Promise<void> {
  const form = addForm();
  await userEvent.type(form.getByRole('textbox', { name: 'Numéros des places' }), range);
  await userEvent.type(form.getByRole('textbox', { name: 'Distance de la sortie, en mètres' }), distance);
  await userEvent.click(form.getByRole('button', { name: 'Ajouter les places' }));
}

export function rowOf(number: string): HTMLElement {
  return screen.getByRole('rowheader', { name: number }).closest('tr') as HTMLElement;
}

export function spotNumbers(): string[] {
  return spotsRegion()
    .queryAllByRole('rowheader')
    .map((cell) => cell.textContent ?? '');
}

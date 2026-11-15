import type { DashboardUser } from '@palier/shared-types';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gatesPath } from '../src/navigation/routes.ts';
import { installFakeApi } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { renderDashboard } from './renderDashboard.tsx';

export interface NewGate {
  readonly name: string;
  readonly kind?: 'ENTRY' | 'EXIT';
  readonly integrationKind?: 'DRY_CONTACT' | 'ACCESS_CONTROL_API' | 'SIMULATED';
  readonly endpoint?: string;
  readonly reportsLoops?: boolean;
}

export async function openGatesOf(user: DashboardUser, lotId: string): Promise<FakeApiState> {
  const api = installFakeApi({ signedInAs: user });
  renderDashboard({ path: gatesPath(lotId) });
  await screen.findByRole('heading', { level: 2, name: 'Bornes installées' });
  return api;
}

export function addGateForm(): HTMLElement {
  return document.querySelector('section[aria-labelledby="add-gate-title"]') as HTMLElement;
}

// Fills the add form in French, leaving each setting not named at its default.
export async function addGate({ name, kind, integrationKind, endpoint, reportsLoops = true }: NewGate): Promise<void> {
  const form = within(addGateForm());
  await userEvent.type(form.getByLabelText('Nom de la borne'), name);
  if (kind !== undefined) {
    await userEvent.selectOptions(form.getByLabelText('Sens'), kind);
  }
  if (integrationKind !== undefined) {
    await userEvent.selectOptions(form.getByLabelText('Raccordement'), integrationKind);
  }
  if (endpoint !== undefined) {
    await userEvent.type(form.getByLabelText('Adresse du contrôleur'), endpoint);
  }
  if (!reportsLoops) {
    await userEvent.click(form.getByLabelText('La borne signale chaque passage sur ses boucles'));
  }
  await userEvent.click(form.getByRole('button', { name: 'Ajouter une borne' }));
}

export function gateItemOf(name: string): HTMLElement {
  const heading = screen.getAllByRole('heading', { level: 3 }).find((found) => found.firstChild?.textContent?.trim() === name);
  return heading?.closest('li') as HTMLElement;
}

export function factOf(item: HTMLElement, label: string): string | null {
  const term = within(item).queryByText(label, { selector: 'dt' });
  return term?.nextElementSibling?.textContent ?? null;
}

export function keyPanel(): HTMLElement | null {
  return document.querySelector('section.key-panel');
}

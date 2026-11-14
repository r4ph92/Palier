import type { DashboardLotMap } from '@palier/shared-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { garageRoy, installFakeApi, pierre } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { renderDashboard } from './renderDashboard.tsx';

export const GARAGE_ROY_MAP = `/lots/${garageRoy.id}/map`;
export const ORDER_REQUEST = `PUT /lots/${garageRoy.id}/levels/order`;
const MOVE_UP = /^Monter /;

export async function openGarageRoyMap(): Promise<FakeApiState> {
  const api = installFakeApi({ signedInAs: pierre });
  renderDashboard({ path: GARAGE_ROY_MAP });
  await screen.findByRole('heading', { level: 1, name: 'Plan et balises — Garage Roy' });
  return api;
}

export async function addLevel(code: string): Promise<void> {
  const box = screen.getByRole('textbox', { name: 'Code du niveau' });
  await userEvent.type(box, code);
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter le niveau' }));
  await screen.findByText(`Niveau ${code} ajouté.`);
}

interface AisleInput {
  readonly code: string;
  readonly minor: string;
  readonly rectangle?: readonly [string, string, string, string];
}

export async function addAisle({ code, minor, rectangle = ['0', '0', '100', '40'] }: AisleInput): Promise<void> {
  const labels = ['Code de l’allée', 'Minor de la balise de l’allée', 'x (depuis la gauche)', 'y (depuis le haut)', 'Largeur', 'Hauteur'];
  const values = [code, minor, ...rectangle];
  for (const [index, label] of labels.entries()) {
    const box = screen.getByRole('textbox', { name: label });
    await userEvent.clear(box);
    await userEvent.type(box, values[index] ?? '');
  }
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’allée' }));
}

// Each level's "Monter" button is named after it, in the order the list shows the levels.
export function levelCodes(): string[] {
  return screen.getAllByRole('button', { name: MOVE_UP }).map((button) => button.getAttribute('aria-label')?.replace(MOVE_UP, '') ?? '');
}

export function orderBodies(): unknown[] {
  const calls = vi.mocked(fetch).mock.calls as [string, RequestInit | undefined][];
  return calls.filter(([url]) => url.endsWith('/levels/order')).map(([, init]) => JSON.parse(String(init?.body)));
}

export function savedMap(api: FakeApiState): DashboardLotMap | undefined {
  return api.maps.get(garageRoy.id);
}

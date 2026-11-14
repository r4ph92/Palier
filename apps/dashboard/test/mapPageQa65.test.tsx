import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, pierre } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { renderDashboard } from './renderDashboard.tsx';

const GARAGE_ROY_MAP = `/lots/${garageRoy.id}/map`;
const FRENCH_FIELDS = ['Code de l’allée', 'Minor de la balise de l’allée', 'x (depuis la gauche)', 'y (depuis le haut)', 'Largeur', 'Hauteur'];
const ENGLISH_FIELDS = ['Aisle code', 'Minor of the aisle’s beacon', 'x (from the left)', 'y (from the top)', 'Width', 'Height'];

async function garageRoyWithP1(): Promise<FakeApiState> {
  const api = installFakeApi({ signedInAs: pierre });
  renderDashboard({ path: GARAGE_ROY_MAP });
  await userEvent.type(await screen.findByRole('textbox', { name: 'Code du niveau' }), 'P1');
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter le niveau' }));
  await screen.findByText('Niveau P1 ajouté.');
  return api;
}

async function fillAisle(labels: readonly string[], values: readonly string[]) {
  for (const [index, label] of labels.entries()) {
    const box = screen.getByRole('textbox', { name: label });
    await userEvent.clear(box);
    await userEvent.type(box, values[index] ?? '');
  }
}

function aisleRequests(api: FakeApiState): string[] {
  return api.requests.filter((request) => request.endsWith('/aisles'));
}

describe('the aisle form against typed numbers (QA #65)', () => {
  it.each([['-1'], ['1,5'], ['1.5'], ['1,000'], ['65 536'], ['1e3'], ['0x10']])(
    'refuses minor %s in French beside the field, and sends nothing',
    async (minor) => {
      const api = await garageRoyWithP1();

      await fillAisle(FRENCH_FIELDS, ['A', minor, '0', '0', '100', '40']);
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’allée' }));

      expect(screen.getByRole('textbox', { name: 'Minor de la balise de l’allée' }).getAttribute('aria-invalid')).toBe('true');
      expect(aisleRequests(api)).toEqual([]);
    },
  );

  it('reads French thousands spaces in the minor and the rectangle', async () => {
    const api = await garageRoyWithP1();

    await fillAisle(FRENCH_FIELDS, ['A', '1 000', '1 000', '0', '2 500', '400']);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’allée' }));

    await screen.findByText('Allée A ajoutée au niveau P1.');
    const aisle = api.maps.get(garageRoy.id)?.levels[0]?.aisles.find(({ code }) => code === 'A');
    expect(aisle).toMatchObject({ beaconMinor: 1000, rectangle: { x: 1000, y: 0, width: 2500, height: 400 } });
  });

  it('reads English thousands commas, which French refuses', async () => {
    const api = await garageRoyWithP1();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await fillAisle(ENGLISH_FIELDS, ['A', '1,000', '1,000', '0', '2,500', '400']);
    await userEvent.click(screen.getByRole('button', { name: 'Add the aisle' }));

    await screen.findByText('Aisle A added to level P1.');
    const aisle = api.maps.get(garageRoy.id)?.levels[0]?.aisles.find(({ code }) => code === 'A');
    expect(aisle).toMatchObject({ beaconMinor: 1000, rectangle: { x: 1000, width: 2500 } });
  });

  it('refuses a rectangle off the grid on its own field and draws nothing for it', async () => {
    const api = await garageRoyWithP1();

    await fillAisle(FRENCH_FIELDS, ['A', '1', '10 001', '0', '0', '40']);

    expect(screen.queryByRole('img', { name: 'Plan du niveau P1' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’allée' }));
    expect(screen.getByRole('textbox', { name: 'x (depuis la gauche)' }).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Largeur' }).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Hauteur' }).getAttribute('aria-invalid')).toBe('false');
    expect(aisleRequests(api)).toEqual([]);
  });
});

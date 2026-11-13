import type { DashboardLotMap } from '@palier/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import type { FakeApiState } from './fakeDashboardData.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { PLATFORM_UUID } from './fakeMapData.ts';
import { renderDashboard } from './renderDashboard.tsx';

const GARAGE_ROY_MAP = `/lots/${garageRoy.id}/map`;
const ORDER_REQUEST = `PUT /lots/${garageRoy.id}/levels/order`;

async function openGarageRoyMap() {
  const api = installFakeApi({ signedInAs: pierre });
  renderDashboard({ path: GARAGE_ROY_MAP });
  await screen.findByRole('heading', { level: 1, name: 'Plan et balises — Garage Roy' });
  return api;
}

async function addLevel(code: string) {
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

async function addAisle({ code, minor, rectangle = ['0', '0', '100', '40'] }: AisleInput) {
  const labels = ['Code de l’allée', 'Minor de la balise de l’allée', 'x (depuis la gauche)', 'y (depuis le haut)', 'Largeur', 'Hauteur'];
  const values = [code, minor, ...rectangle];
  for (const [index, label] of labels.entries()) {
    const box = screen.getByRole('textbox', { name: label });
    const value = values[index] ?? '';
    await userEvent.clear(box);
    await userEvent.type(box, value);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’allée' }));
}

function levelCodes(): string[] {
  const list = screen.getByRole('list');
  return within(list).getAllByRole('listitem').map((item) => item.querySelector('.row-name')?.textContent ?? '');
}

function orderBodies(): unknown[] {
  const calls = vi.mocked(fetch).mock.calls as [string, RequestInit | undefined][];
  return calls.filter(([url]) => url.endsWith('/levels/order')).map(([, init]) => JSON.parse(String(init?.body)));
}

function savedMap(api: FakeApiState): DashboardLotMap | undefined {
  return api.maps.get(garageRoy.id);
}

describe('the map of a lot', () => {
  it('starts Garage Roy empty, shows P1 then P2 once added, and swaps them with Monter P2', async () => {
    const api = await openGarageRoyMap();
    expect(screen.getByText(/^Aucun niveau\. Ajoutez le premier/)).toBeDefined();

    await addLevel('P1');
    await addLevel('P2');
    expect(levelCodes()).toEqual(['P1', 'P2']);
    expect((screen.getByRole('button', { name: 'Monter P1' }) as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Monter P2' }));

    await waitFor(() => expect(levelCodes()).toEqual(['P2', 'P1']));
    const [p1, p2] = savedMap(api)?.levels.map(({ id }) => id).reverse() ?? [];
    expect(api.requests.filter((request) => request === ORDER_REQUEST)).toHaveLength(1);
    expect(savedMap(api)?.levels.map(({ id }) => id)).toEqual([p2, p1]);
    expect(orderBodies()).toEqual([{ levelIds: [p2, p1], fromLevelIds: [p1, p2] }]);
    expect(screen.getByText('P2, position 1 sur 2')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Descendre P2' }));
  });

  it('keeps focus on Descendre P1 when P1 moves down but is not yet last', async () => {
    await openGarageRoyMap();
    await addLevel('P1');
    await addLevel('P2');
    await addLevel('P3');

    await userEvent.click(screen.getByRole('button', { name: 'Descendre P1' }));

    await waitFor(() => expect(levelCodes()).toEqual(['P2', 'P1', 'P3']));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Descendre P1' }));
  });

  it('leaves the order as it was and says why when the move fails', async () => {
    const api = await openGarageRoyMap();
    await addLevel('P1');
    await addLevel('P2');
    api.answers.set(ORDER_REQUEST, { status: 500 });

    await userEvent.click(screen.getByRole('button', { name: 'Monter P2' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect(levelCodes()).toEqual(['P1', 'P2']);
  });

  it('reads the map again when the levels changed under the page', async () => {
    const api = await openGarageRoyMap();
    await addLevel('P1');
    await addLevel('P2');
    api.answers.set(ORDER_REQUEST, { status: 409, body: { statusCode: 409, error: 'LEVEL_ORDER_INVALID', message: '' } });
    const readsBefore = api.requests.filter((request) => request === `GET /lots/${garageRoy.id}/map`).length;

    await userEvent.click(screen.getByRole('button', { name: 'Monter P2' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/^Les niveaux ont changé entre-temps\./);
    expect(api.requests.filter((request) => request === `GET /lots/${garageRoy.id}/map`)).toHaveLength(readsBefore + 1);
  });

  it('shows the exit lane with the first level, then aisle A with minor 1 in the list and on the plan', async () => {
    const api = await openGarageRoyMap();
    await addLevel('P1');
    expect(screen.getAllByText('Voie de sortie').length).toBeGreaterThan(0);

    await addAisle({ code: 'A', minor: '1' });

    await screen.findByText('Allée A ajoutée au niveau P1.');
    const plan = screen.getByRole('img', { name: 'Plan du niveau P1' });
    expect(plan.querySelector('text')?.textContent).toBe('A');
    expect(screen.getByText('Allées dessinées : A.')).toBeDefined();
    const aisles = within(screen.getByRole('region', { name: 'Allées' }));
    expect(aisles.getByRole('rowheader', { name: 'A' }).closest('tr')?.textContent).toContain('x 0 et y 0, largeur 100, hauteur 40');
    expect(savedMap(api)?.levels[0]?.aisles.find(({ code }) => code === 'A')).toMatchObject({ beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } });
    expect(screen.getByRole('textbox', { name: 'Code de l’allée' })).toHaveProperty('value', '');
  });

  it('draws the aisle being typed dashed, once its rectangle is on the grid', async () => {
    await openGarageRoyMap();
    await addLevel('P1');
    expect(screen.getByText('Rien n’est encore dessiné sur ce niveau.')).toBeDefined();

    for (const [label, value] of [['x (depuis la gauche)', '0'], ['y (depuis le haut)', '0'], ['Largeur', '100'], ['Hauteur', '40']] as const) {
      await userEvent.type(screen.getByRole('textbox', { name: label }), value);
    }

    expect(screen.getByRole('img', { name: 'Plan du niveau P1' }).querySelector('.plan-aisle-draft')).not.toBeNull();
    expect(screen.getByText('Allée en cours d’ajout, en pointillé.')).toBeDefined();
  });

  it.each([
    ['0', 'Entrez un nombre entier de 1 à 65 535. Le minor 0 est réservé à la voie de sortie.'],
    ['65536', 'Entrez un nombre entier de 1 à 65 535. Le minor 0 est réservé à la voie de sortie.'],
    ['1,5', 'Entrez un nombre entier de 1 à 65 535. Le minor 0 est réservé à la voie de sortie.'],
  ])('refuses minor %s beside its field and sends nothing', async (minor, message) => {
    const api = await openGarageRoyMap();
    await addLevel('P1');

    await addAisle({ code: 'A', minor });

    const minorBox = screen.getByRole('textbox', { name: 'Minor de la balise de l’allée' });
    expect(minorBox.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(`${minorBox.id}-error`)?.textContent?.replace(/\s/g, ' ')).toBe(message);
    expect(api.requests.some((request) => request.endsWith('/aisles'))).toBe(false);
  });

  it('says beside the minor that another aisle uses it, and saves nothing', async () => {
    const api = await openGarageRoyMap();
    await addLevel('P1');
    await addAisle({ code: 'A', minor: '1' });
    await screen.findByText('Allée A ajoutée au niveau P1.');

    await addAisle({ code: 'B', minor: '1', rectangle: ['0', '50', '100', '40'] });

    expect(await screen.findByText('Une autre allée de ce stationnement utilise déjà ce minor.')).toBeDefined();
    expect(savedMap(api)?.levels[0]?.aisles.map(({ code }) => code)).toEqual(['A', 'Sortie']);
  });

  it('lists the platform UUID, the lot major and every minor under Balises', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}/map` });

    const beacons = within(await screen.findByRole('region', { name: 'Balises' }));

    expect(beacons.getByText(PLATFORM_UUID)).toBeDefined();
    expect(beacons.getByText('Major du stationnement').nextElementSibling?.textContent).toBe('1');
    const rows = beacons.getAllByRole('row').slice(1).map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toEqual([['P1', 'A', '1'], ['P1', 'B', '2'], ['P1', 'Voie de sortie', '0']]);
  });

  it('names the exit lane in English and never by its stored code, with the map entirely in English', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}/map` });
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { level: 1, name: 'Map and beacons — Parking Démo' });

    expect(screen.getAllByText('Exit lane').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sortie/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add the aisle' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Plan of level P1' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('shows the English field errors and limits of the aisle form', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}/map` });
    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Add the aisle' }));

    expect(screen.getByRole('alert').textContent).toBe('Fix the fields shown.');
    expect(screen.getAllByText('Enter a whole number from 0 to 10,000; width and height are at least 1.')).toHaveLength(4);
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('opens from the lot page', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: `/lots/${garageRoy.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Plan et balises' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Plan et balises — Garage Roy' })).toBeDefined();
    expect(window.location.pathname).toBe(GARAGE_ROY_MAP);
  });

  it('gives Sophie not found on Pierre’s map, and nothing of it', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: GARAGE_ROY_MAP });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Garage Roy/)).toBeNull();
  });

  it('shows the map as unavailable with a retry, then opens it', async () => {
    const api = installFakeApi({ signedInAs: pierre, answers: { [`GET /lots/${garageRoy.id}/map`]: { status: 500 } } });
    renderDashboard({ path: GARAGE_ROY_MAP });

    expect(await screen.findByRole('heading', { level: 1, name: 'Plan indisponible' })).toBeDefined();
    api.answers.delete(`GET /lots/${garageRoy.id}/map`);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Plan et balises — Garage Roy' })).toBeDefined();
  });
});

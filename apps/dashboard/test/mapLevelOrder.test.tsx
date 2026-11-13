import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy } from './fakeDashboardApi.ts';
import { addLevel, levelCodes, openGarageRoyMap, ORDER_REQUEST, orderBodies, savedMap } from './mapPageSteps.ts';

describe('the order of the levels on the map of a lot', () => {
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

  it('says the map could not be reloaded when the read after a stale move fails too', async () => {
    const api = await openGarageRoyMap();
    await addLevel('P1');
    await addLevel('P2');
    api.answers.set(ORDER_REQUEST, { status: 409, body: { statusCode: 409, error: 'LEVEL_ORDER_INVALID', message: '' } });
    api.answers.set(`GET /lots/${garageRoy.id}/map`, { status: 500 });

    await userEvent.click(screen.getByRole('button', { name: 'Monter P2' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Les niveaux ont changé entre-temps, et le plan n’a pas pu être rechargé. Rechargez la page avant de recommencer.',
    );
  });

  it('shows no move button for a lone level, then a short verb named after each level', async () => {
    await openGarageRoyMap();
    await addLevel('P1');
    expect(screen.queryByRole('button', { name: /^(Monter|Descendre) / })).toBeNull();

    await addLevel('P2');

    expect(screen.getByRole('button', { name: 'Monter P2' }).textContent).toBe('Monter');
    expect(screen.getByRole('button', { name: 'Descendre P1' }).textContent).toBe('Descendre');
  });
});

import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, pierre } from './fakeDashboardApi.ts';
import { CREATED_LOT_ID } from './fakeLotRoutes.ts';
import { renderDashboard } from './renderDashboard.tsx';

async function fillGarageRoyNord() {
  await userEvent.type(await screen.findByLabelText('Nom'), 'Garage Roy Nord');
  await userEvent.type(screen.getByLabelText('Adresse'), '8000, boulevard Saint-Laurent, Montréal');
  await userEvent.type(screen.getByLabelText('Latitude (degrés décimaux)'), '45,54');
  await userEvent.type(screen.getByLabelText('Longitude (degrés décimaux)'), '-73,62');
  await userEvent.type(screen.getByLabelText('Capacité'), '40');
}

function createButton() {
  return screen.getByRole('button', { name: 'Créer le stationnement' });
}

describe('creating a lot', () => {
  it('creates Garage Roy Nord, opens its page, and lists it as Hors ligne in Pierre’s lots', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    renderDashboard();
    await userEvent.click(await screen.findByRole('link', { name: 'Créer un stationnement' }));
    await fillGarageRoyNord();

    await userEvent.click(createButton());

    expect(await screen.findByRole('heading', { level: 1, name: 'Garage Roy Nord' })).toBeDefined();
    expect(window.location.pathname).toBe(`/lots/${CREATED_LOT_ID}`);
    expect(api.requests).toContain('POST /lots');
    await userEvent.click(screen.getByRole('link', { name: 'Retour aux stationnements' }));
    const row = await screen.findByRole('link', { name: /Garage Roy Nord/ });
    expect(within(row).getByText('Hors ligne')).toBeDefined();
  });

  it('sends the coordinates and the capacity as numbers, read from French decimals', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();

    await userEvent.click(createButton());

    await screen.findByRole('heading', { level: 1, name: 'Garage Roy Nord' });
    expect(api.lots.get('00000000-0000-4000-8000-000000000102')?.at(-1)).toMatchObject({ latitude: 45.54, longitude: -73.62, capacity: 40 });
  });

  it('shows each wrong field its own error and a summary that takes focus, and sends nothing', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: '/lots/new' });
    await userEvent.type(await screen.findByLabelText('Latitude (degrés décimaux)'), '91');
    await userEvent.type(screen.getByLabelText('Capacité'), '40,5');

    await userEvent.click(createButton());

    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toBe('Corrigez les champs indiqués.');
    expect(screen.getByLabelText('Nom').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Entrez le nom du stationnement.').id).toBe('lot-name-error');
    expect(screen.getByLabelText('Latitude (degrés décimaux)').getAttribute('aria-describedby')).toBe('lot-latitude-hint lot-latitude-error');
    expect(screen.getByText('Entrez la latitude en degrés décimaux, de -90 à 90.')).toBeDefined();
    expect(screen.queryByText('Entrez la longitude en degrés décimaux, de -180 à 180.')).toBeNull();
    expect(screen.getByText('Entrez un nombre entier de places, de 0 à 10 000.')).toBeDefined();
    expect(api.requests).not.toContain('POST /lots');
  });

  it('clears only the error of the field being corrected', async () => {
    installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: '/lots/new' });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer le stationnement' }));

    await userEvent.type(screen.getByLabelText('Nom'), 'Garage Roy Nord');

    expect(screen.getByLabelText('Nom').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByLabelText('Adresse').getAttribute('aria-invalid')).toBe('true');
  });

  it('places an API refusal of a field beside that field', async () => {
    const refusal = { status: 400, body: { statusCode: 400, error: 'LOT_ADDRESS_INVALID', message: '' } };
    installFakeApi({ signedInAs: pierre, answers: { 'POST /lots': refusal } });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();

    await userEvent.click(createButton());

    expect(await screen.findByText('L’adresse doit compter de 1 à 200 caractères, sans caractère invisible.')).toBeDefined();
    expect(screen.getByLabelText('Adresse').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Corrigez les champs indiqués.');
  });

  it('shows a refusal that names no field in the summary and keeps what was typed', async () => {
    installFakeApi({ signedInAs: pierre, answers: { 'POST /lots': { status: 500 } } });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();

    await userEvent.click(createButton());

    expect((await screen.findByRole('alert')).textContent).toBe('Une erreur est survenue. Réessayez dans un instant.');
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Garage Roy Nord');
  });

  it('tells Pierre to wait an hour once he has created too many lots', async () => {
    const refusal = { status: 429, body: { statusCode: 429, error: 'TOO_MANY_LOTS', message: '' } };
    installFakeApi({ signedInAs: pierre, answers: { 'POST /lots': refusal } });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();

    await userEvent.click(createButton());

    expect((await screen.findByRole('alert')).textContent).toBe('Trop de stationnements créés en peu de temps. Réessayez dans une heure.');
  });

  it('sends one request for three presses in the same instant', async () => {
    const api = installFakeApi({ signedInAs: pierre, answers: { 'POST /lots': 'pending' } });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();
    const button = createButton();

    act(() => {
      button.click();
      button.click();
      button.click();
    });

    expect(api.requests.filter((request) => request === 'POST /lots')).toHaveLength(1);
  });

  it('sends one request however often the button is pressed while it is on its way', async () => {
    const api = installFakeApi({ signedInAs: pierre, answers: { 'POST /lots': 'pending' } });
    renderDashboard({ path: '/lots/new' });
    await fillGarageRoyNord();

    await userEvent.click(createButton());
    await userEvent.click(screen.getByRole('button', { name: 'Création…' }));

    expect(api.requests.filter((request) => request === 'POST /lots')).toHaveLength(1);
  });
});

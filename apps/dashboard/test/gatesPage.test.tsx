import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { addGate, addGateForm, factOf, gateItemOf, keyPanel, openGatesOf } from './gatesPageSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

const ENDPOINT = 'https://controle.garageroy.ca/portes';

describe('the gates page', () => {
  it('opens from the lot page and lists each gate with its settings', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Bornes et QR' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Bornes — Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(`/lots/${parkingDemo.id}/gates`);
    const sortie = gateItemOf('Sortie Démo');
    expect(factOf(sortie, 'Raccordement')).toBe('Simulée (console de démonstration)');
    expect(factOf(sortie, 'Identification à la sortie')).toBe('Aucune');
    expect(factOf(gateItemOf('Entrée Démo'), 'Identification à la sortie')).toBeNull();
  });

  it('adds Entrée principale on the access-control API, and lists it with its endpoint and its loops', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);

    await addGate({ name: 'Entrée principale', integrationKind: 'ACCESS_CONTROL_API', endpoint: ENDPOINT, reportsLoops: false });

    const added = await screen.findByText('Entrée principale', { selector: 'h3 *, h3' });
    const item = added.closest('li') as HTMLElement;
    expect(factOf(item, 'Sens')).toBe('Entrée');
    expect(factOf(item, 'Raccordement')).toBe('API de contrôle d’accès');
    expect(factOf(item, 'Adresse du contrôleur')).toBe(ENDPOINT);
    expect(factOf(item, 'Boucles')).toBe('Non signalées');
    expect(api.requests.filter((request) => request === `POST /lots/${garageRoy.id}/gates`)).toHaveLength(1);
    expect(within(addGateForm()).getByLabelText<HTMLInputElement>('Nom de la borne').value).toBe('');
  });

  it.each([
    ['an http endpoint', 'http://controle.garageroy.ca', 'Entrez une adresse https, comme https://controle.exemple.ca, sans nom d’utilisateur ni mot de passe.'],
    ['no endpoint for the access-control API', undefined, 'L’API de contrôle d’accès demande l’adresse https de son contrôleur.'],
  ])('refuses %s beside the field, sending nothing', async (_case, endpoint, sentence) => {
    const api = await openGatesOf(pierre, garageRoy.id);

    await addGate({ name: 'Entrée principale', integrationKind: 'ACCESS_CONTROL_API', ...(endpoint === undefined ? {} : { endpoint }) });

    const field = within(addGateForm()).getByLabelText('Adresse du contrôleur');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(within(addGateForm()).getAllByText(sentence).length).toBeGreaterThan(0);
    expect(api.requests).not.toContain(`POST /lots/${garageRoy.id}/gates`);
  });

  it('refuses a second exit gate on the direction field, whose hint already says the limit', async () => {
    await openGatesOf(sophie, parkingDemo.id);
    const direction = () => within(addGateForm()).getByLabelText('Sens');
    expect(direction().getAttribute('aria-describedby')).toBe('new-gate-kind-hint');
    expect(within(addGateForm()).getByText('Une seule borne de sortie par stationnement pour l’instant.')).toBeDefined();

    await addGate({ name: 'Sortie Sud', kind: 'EXIT' });

    expect(await within(addGateForm()).findByText('Ce stationnement a déjà sa borne de sortie. Choisissez Entrée.')).toBeDefined();
    expect(direction().getAttribute('aria-invalid')).toBe('true');
    expect(direction().getAttribute('aria-describedby')).toBe('new-gate-kind-hint new-gate-kind-error');
    expect(within(addGateForm()).getByRole('alert').textContent).toBe('Corrigez les champs indiqués.');
    expect(gateItemOf('Sortie Sud')).toBeUndefined();
  });
});

describe('the exit identification of a gate', () => {
  it('sets an exit gate to read plates, then transponders, and the gate shows each', async () => {
    await openGatesOf(sophie, parkingDemo.id);

    for (const [value, shown] of [['PLATE', 'Plaque'], ['TRANSPONDER', 'Transpondeur']] as const) {
      await userEvent.click(within(gateItemOf('Sortie Démo')).getByRole('button', { name: 'Modifier Sortie Démo' }));
      await userEvent.selectOptions(within(gateItemOf('Sortie Démo')).getByLabelText('Identification à la sortie'), value);
      await userEvent.click(within(gateItemOf('Sortie Démo')).getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText('Borne enregistrée : Sortie Démo.')).toBeDefined();
      expect(factOf(gateItemOf('Sortie Démo'), 'Identification à la sortie')).toBe(shown);
    }
  });

  it('offers no exit identification and no direction when editing an entry gate', async () => {
    await openGatesOf(sophie, parkingDemo.id);

    await userEvent.click(within(gateItemOf('Entrée Démo')).getByRole('button', { name: 'Modifier Entrée Démo' }));

    const form = within(gateItemOf('Entrée Démo'));
    expect(form.queryByLabelText('Identification à la sortie')).toBeNull();
    expect(form.queryByLabelText('Sens')).toBeNull();
    expect(form.getByLabelText('Raccordement')).toBeDefined();
  });
});

describe('the device key of a gate', () => {
  it('shows the new gate’s key once, with the warning, then only offers to regenerate it', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);

    await addGate({ name: 'Entrée principale' });

    const panel = await screen.findByRole('region', { name: 'Clé d’appareil — Entrée principale' });
    expect(within(panel).getByText('Copiez cette clé, elle ne sera plus affichée.')).toBeDefined();
    const deviceKey = panel.querySelector('code')?.textContent ?? '';
    expect(deviceKey).toMatch(/^device-key-/);
    expect(document.activeElement?.id).toBe('device-key-title');

    await userEvent.click(within(panel).getByRole('button', { name: 'J’ai copié la clé' }));

    expect(keyPanel()).toBeNull();
    expect(document.body.textContent).not.toContain(deviceKey);
    const item = within(gateItemOf('Entrée principale'));
    expect(item.getByRole('button', { name: 'Régénérer la clé de Entrée principale' })).toBeDefined();
    expect(item.queryByRole('button', { name: /afficher|voir/i })).toBeNull();
    expect(api.requests.filter((request) => request.includes('device-key'))).toEqual([]);
  });

  it('marks a copied key with the free state mark', async () => {
    await openGatesOf(pierre, garageRoy.id);
    await addGate({ name: 'Entrée principale' });
    const panel = await screen.findByRole('region', { name: 'Clé d’appareil — Entrée principale' });

    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await userEvent.click(within(panel).getByRole('button', { name: 'Copier la clé' }));

    expect(writeText).toHaveBeenCalledWith(panel.querySelector('code')?.textContent);
    const status = within(panel).getByRole('status');
    expect(await within(status).findByText('Clé copiée.')).toBeDefined();
    expect(status.querySelector('.state-mark-free')).not.toBeNull();
  });

  it('still shows the key when the API could not read the list after saving, and reads the list itself', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);
    const gatesRequest = `GET /lots/${garageRoy.id}/gates`;
    api.answers.set(`POST /lots/${garageRoy.id}/gates`, { status: 201, body: { gateId: 'gate-new', deviceKey: 'device-key-new', lotGates: null } });

    await addGate({ name: 'Entrée principale' });

    const panel = await screen.findByRole('region', { name: 'Clé d’appareil — Entrée principale' });
    expect(panel.querySelector('code')?.textContent).toBe('device-key-new');
    expect(api.requests.filter((request) => request === gatesRequest)).toHaveLength(2);
  });

  it('regenerates a key only once confirmed, and shows the new one with the same warning', async () => {
    const api = await openGatesOf(pierre, garageRoy.id);
    const item = () => within(gateItemOf('Entrée Roy'));

    await userEvent.click(item().getByRole('button', { name: 'Régénérer la clé de Entrée Roy' }));
    expect(item().getByText('Régénérer la clé ? Le contrôleur qui utilise l’ancienne sera refusé.')).toBeDefined();
    await userEvent.click(item().getByRole('button', { name: 'Annuler' }));
    expect(api.requests.filter((request) => request.endsWith('/device-key'))).toEqual([]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Régénérer la clé de Entrée Roy');

    await userEvent.click(item().getByRole('button', { name: 'Régénérer la clé de Entrée Roy' }));
    await userEvent.click(item().getByRole('button', { name: 'Régénérer la clé de Entrée Roy' }));

    const panel = await screen.findByRole('region', { name: 'Clé d’appareil — Entrée Roy' });
    expect(within(panel).getByText('Copiez cette clé, elle ne sera plus affichée.')).toBeDefined();
    expect(api.requests.filter((request) => request.endsWith('/device-key'))).toHaveLength(1);
  });
});

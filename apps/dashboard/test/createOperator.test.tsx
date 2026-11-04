import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, julie, lavoie, nouvelOperateur, parkingDemo } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('creating an operator', () => {
  it('creates Stationnements Exemple inc. with Stripe not started and no lots', async () => {
    installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();

    await userEvent.type(await screen.findByLabelText('Raison sociale'), 'Stationnements Exemple inc.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Stationnements Exemple inc.' })).toBeDefined();
    expect(screen.getByText('Non commencé')).toBeDefined();
    expect(await screen.findByText('Aucun stationnement pour l’instant.')).toBeDefined();
  });

  it('refuses a one-letter legal name without calling the API and keeps what was typed', async () => {
    const api = installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();
    const field = await screen.findByLabelText('Raison sociale');

    await userEvent.type(field, 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(screen.getByRole('alert').textContent).toBe('La raison sociale doit compter de 2 à 120 caractères, sans caractère invisible.');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect((field as HTMLInputElement).value).toBe('a');
    expect(api.requests).not.toContain('POST /operators');
  });

  it('clears the length error as soon as the name changes', async () => {
    installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();
    const field = await screen.findByLabelText('Raison sociale');
    await userEvent.type(field, 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    await userEvent.type(field, 'b');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
  });

  it('clears the previous failure while the next attempt is on its way', async () => {
    const api = installFakeApi({ signedInAs: nouvelOperateur, answers: { 'POST /operators': { status: 500 } } });
    renderDashboard();
    const field = await screen.findByLabelText('Raison sociale');
    await userEvent.type(field, 'Stationnements Exemple inc.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));
    expect(await screen.findByRole('alert')).toBeDefined();

    api.answers.set('POST /operators', 'pending');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(await screen.findByRole('button', { name: 'Création…' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
  });

  it('sends one request however often the button is pressed while it is on its way', async () => {
    const api = installFakeApi({ signedInAs: nouvelOperateur, answers: { 'POST /operators': 'pending' } });
    renderDashboard();
    await userEvent.type(await screen.findByLabelText('Raison sociale'), 'Stationnements Exemple inc.');
    const button = screen.getByRole('button', { name: 'Créer l’opérateur' });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(api.requests.filter((request) => request === 'POST /operators')).toHaveLength(1);
  });

  it('moves focus to the notice when the creation fails', async () => {
    installFakeApi({ signedInAs: nouvelOperateur, answers: { 'POST /operators': { status: 500 } } });
    renderDashboard();
    await userEvent.type(await screen.findByLabelText('Raison sociale'), 'Stationnements Exemple inc.');

    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(document.activeElement).toBe(await screen.findByRole('alert'));
  });

  it('refuses a legal name of zero-width spaces without calling the API, by the rule the API applies', async () => {
    const api = installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();

    await userEvent.type(await screen.findByLabelText('Raison sociale'), '\u200B\u200B\u200B');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(screen.getByRole('alert')).toBeDefined();
    expect(api.requests).not.toContain('POST /operators');
  });

  it('gives the length limits in the field hint', async () => {
    installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();

    expect(await screen.findByText('De 2 à 120 caractères, telle qu’inscrite au registre.')).toBeDefined();
  });

  it('shows the operator when it was created meanwhile, in another tab say', async () => {
    const api = installFakeApi({ signedInAs: nouvelOperateur });
    renderDashboard();
    await userEvent.type(await screen.findByLabelText('Raison sociale'), 'Stationnements Exemple inc.');

    api.me = { user: nouvelOperateur, operator: lavoie };
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’opérateur' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' })).toBeDefined();
  });

  it('asks Julie to create an operator even at the address of Parking Démo, and shows her no operator data', async () => {
    const api = installFakeApi({ signedInAs: julie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    expect(await screen.findByRole('heading', { level: 1, name: 'Créer votre opérateur' })).toBeDefined();
    expect(screen.getByText(/Bonjour Julie\./)).toBeDefined();
    expect(screen.queryByText('Parking Démo')).toBeNull();
    expect(api.requests).toEqual(['GET /me']);
  });
});

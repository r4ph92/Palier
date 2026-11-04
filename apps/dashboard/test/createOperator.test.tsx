import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, julie, nouvelOperateur, parkingDemo } from './fakeDashboardApi.ts';
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

    expect(screen.getByRole('alert').textContent).toBe('La raison sociale doit compter de 2 à 120 caractères.');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect((field as HTMLInputElement).value).toBe('a');
    expect(api.requests).not.toContain('POST /operators');
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

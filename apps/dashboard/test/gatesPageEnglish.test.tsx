import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';
import { addGateForm, factOf, gateItemOf, openGatesOf } from './gatesPageSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

async function inEnglish(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'English' }));
  await screen.findByRole('heading', { level: 1, name: 'Terminals — Parking Démo' });
}

describe('the gates page of another operator’s lot', () => {
  it('answers Sophie that Pierre’s lot is not found, showing none of its gates', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${garageRoy.id}/gates` });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByText(/Entrée Roy/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Imprimer le QR|Régénérer/ })).toBeNull();
    expect(api.requests).toContain(`GET /lots/${garageRoy.id}/gates`);
  });
});

describe('the gates page in English', () => {
  it('reads the list, its settings and the add form in English, with no French left', async () => {
    await openGatesOf(sophie, parkingDemo.id);

    await inEnglish();

    const sortie = gateItemOf('Sortie Démo');
    expect(factOf(sortie, 'Connection')).toBe('Simulated (demo console)');
    expect(factOf(sortie, 'Exit identification')).toBe('None');
    expect(within(sortie).getByRole('button', { name: 'Print the QR code of Sortie Démo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add a terminal' })).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('keeps the edit form, a regeneration question and a refusal in English', async () => {
    await openGatesOf(sophie, parkingDemo.id);
    await inEnglish();

    await userEvent.click(within(gateItemOf('Sortie Démo')).getByRole('button', { name: 'Edit Sortie Démo' }));
    expect(within(gateItemOf('Sortie Démo')).getByLabelText('Exit identification')).toBeDefined();
    await userEvent.click(within(gateItemOf('Entrée Démo')).getByRole('button', { name: 'Regenerate the QR secret of Entrée Démo' }));
    expect(screen.getByText('Regenerate the QR secret? Printed QR codes will stop working.')).toBeDefined();
    await userEvent.type(within(addGateForm()).getByLabelText('Terminal name'), 'Sortie Sud');
    await userEvent.selectOptions(within(addGateForm()).getByLabelText('Direction'), 'EXIT');
    await userEvent.click(screen.getByRole('button', { name: 'Add a terminal' }));

    expect(await screen.findByText('This parking lot already has its exit terminal. Choose Entry.')).toBeDefined();
    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('shows a new gate’s key with its warning in English', async () => {
    await openGatesOf(sophie, parkingDemo.id);
    await inEnglish();

    await userEvent.type(within(addGateForm()).getByLabelText('Terminal name'), 'Entrée Est');
    await userEvent.click(screen.getByRole('button', { name: 'Add a terminal' }));

    const panel = await screen.findByRole('region', { name: 'Device key — Entrée Est' });
    expect(within(panel).getByText('Copy this key, it will not be shown again.')).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'I copied the key' })).toBeDefined();
    expect(frenchLeftOnEnglishPage().filter((fragment) => !'Entrée Est'.includes(fragment))).toEqual([]);
  });
});

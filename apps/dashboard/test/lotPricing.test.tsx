import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const LABELS = {
  incrementCents: 'Prix par incrément',
  incrementMinutes: 'Durée de l’incrément, en minutes',
  dailyCapCents: 'Plafond journalier',
  holdQuota: 'Places garanties',
} as const;

type PricingInput = Partial<Record<keyof typeof LABELS, string>>;

async function openGarageRoy() {
  const api = installFakeApi({ signedInAs: pierre });
  renderDashboard({ path: `/lots/${garageRoy.id}` });
  await screen.findByRole('heading', { level: 1, name: 'Garage Roy' });
  return api;
}

async function enterPricing(input: PricingInput) {
  for (const [field, value] of Object.entries(input) as [keyof typeof LABELS, string][]) {
    const box = screen.getByRole('textbox', { name: LABELS[field] });
    await userEvent.clear(box);
    if (value !== '') {
      await userEvent.type(box, value);
    }
  }
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la tarification' }));
}

const royPricing = { incrementCents: '1,00', incrementMinutes: '20', dailyCapCents: '18,00', holdQuota: '4' };

describe('the pricing of a lot', () => {
  it('shows Garage Roy without pricing, then with 1,00 $ per 20 minutes, a cap of 18,00 $ and 4 guarantees once saved', async () => {
    const api = await openGarageRoy();
    expect(screen.getByText('Aucune tarification. Le stationnement ne peut pas être mis en ligne sans elle.')).toBeDefined();

    await enterPricing(royPricing);

    expect(await screen.findByText('1,00 $ par 20 min')).toBeDefined();
    expect(screen.getByText('18,00 $')).toBeDefined();
    expect(screen.getByText('4 garanties')).toBeDefined();
    expect(screen.getByRole('status').textContent).toMatch(/^Tarification enregistrée\./);
    expect(api.requests).toContain(`PUT /lots/${garageRoy.id}/pricing`);
    expect(api.lots.get('00000000-0000-4000-8000-000000000102')?.[0]?.pricing).toEqual({ incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 });
  });

  it('says Le plafond journalier est obligatoire when the cap is empty, and saves nothing', async () => {
    const api = await openGarageRoy();

    await enterPricing({ ...royPricing, dailyCapCents: '' });

    expect(screen.getByText('Le plafond journalier est obligatoire')).toBeDefined();
    expect(screen.getByRole('textbox', { name: LABELS.dailyCapCents }).getAttribute('aria-invalid')).toBe('true');
    expect(api.requests.some((request) => request.startsWith('PUT'))).toBe(false);
  });

  it.each([
    { case: 'a zero amount', change: { incrementCents: '0' }, field: 'incrementCents', message: 'Entrez un montant plus grand que zéro, d’au plus 100 000,00 $.' },
    { case: 'a negative amount', change: { incrementCents: '-1,00' }, field: 'incrementCents', message: 'Entrez un montant plus grand que zéro, d’au plus 100 000,00 $.' },
    { case: 'a 4-minute increment', change: { incrementMinutes: '4' }, field: 'incrementMinutes', message: 'Entrez un nombre entier de minutes, de 5 à 60.' },
    { case: 'a 61-minute increment', change: { incrementMinutes: '61' }, field: 'incrementMinutes', message: 'Entrez un nombre entier de minutes, de 5 à 60.' },
    { case: 'a cap under one increment', change: { dailyCapCents: '0,50' }, field: 'dailyCapCents', message: 'Le plafond journalier doit valoir au moins le prix d’un incrément.' },
    { case: 'a negative cap', change: { dailyCapCents: '-18' }, field: 'dailyCapCents', message: 'Entrez un plafond de 0,50 $ à 100 000,00 $.' },
    { case: 'a hold quota of 51', change: { holdQuota: '51' }, field: 'holdQuota', message: 'Entrez un nombre entier de places garanties, de 0 à 50.' },
  ] as const)('refuses $case on its field and saves nothing', async ({ change, field, message }) => {
    const api = await openGarageRoy();

    await enterPricing({ ...royPricing, ...change });

    expect(document.getElementById(`pricing-${field}-error`)?.textContent?.replace(/\s/g, ' ')).toBe(message);
    expect(api.requests.some((request) => request.startsWith('PUT'))).toBe(false);
  });

  it('shows every wrong field at once under one summary', async () => {
    await openGarageRoy();

    await enterPricing({ incrementCents: '0', incrementMinutes: '61', dailyCapCents: '', holdQuota: '51' });

    expect(screen.getByRole('alert').textContent).toBe('Corrigez les champs indiqués.');
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(4);
  });

  it('starts from the saved pricing of Parking Démo and shows a quota of 1 in the singular', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });
    await screen.findByRole('heading', { level: 1, name: 'Parking Démo' });
    expect((screen.getByRole('textbox', { name: LABELS.incrementCents }) as HTMLInputElement).value).toBe('0,75');

    await enterPricing({ holdQuota: '1' });

    expect(await screen.findByText('1 garantie')).toBeDefined();
  });

  it('places an API refusal of the cap beside the cap', async () => {
    const refusal = { status: 400, body: { statusCode: 400, error: 'PRICING_DAILY_CAP_BELOW_INCREMENT', message: '' } };
    installFakeApi({ signedInAs: pierre, answers: { [`PUT /lots/${garageRoy.id}/pricing`]: refusal } });
    renderDashboard({ path: `/lots/${garageRoy.id}` });
    await screen.findByRole('heading', { level: 1, name: 'Garage Roy' });

    await enterPricing(royPricing);

    expect(await screen.findByText('Le plafond journalier doit valoir au moins le prix d’un incrément.')).toBeDefined();
    expect(screen.queryByRole('status')?.textContent).toBe('');
  });

  it('says Daily cap is required in English', async () => {
    await openGarageRoy();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Price per increment' }), '1.00');
    await userEvent.type(screen.getByRole('textbox', { name: 'Increment length, in minutes' }), '20');

    await userEvent.click(screen.getByRole('button', { name: 'Save the pricing' }));

    expect(screen.getByText('Daily cap is required')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Fix the fields shown.');
  });
});

describe('the facts of a lot', () => {
  it('shows the address, the coordinates, the capacity, the state and the beacon major of Parking Démo', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    expect(await screen.findByText('500, rue Peel, Montréal (Québec)')).toBeDefined();
    expect(screen.getByText('45,50165')).toBeDefined();
    expect(screen.getByText('-73,5673')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('En ligne')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });
});

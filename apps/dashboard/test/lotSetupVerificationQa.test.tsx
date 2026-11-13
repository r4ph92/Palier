import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, pierre } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const ROY_OPERATOR_ID = '00000000-0000-4000-8000-000000000102';

const FRENCH_LABELS = {
  incrementCents: 'Prix par incrément',
  incrementMinutes: 'Durée de l’incrément, en minutes',
  dailyCapCents: 'Plafond journalier',
  holdQuota: 'Places garanties',
} as const;

const ENGLISH_LABELS = {
  incrementCents: 'Price per increment',
  incrementMinutes: 'Increment length, in minutes',
  dailyCapCents: 'Daily cap',
  holdQuota: 'Guaranteed spots',
} as const;

type PricingInput = Partial<Record<keyof typeof FRENCH_LABELS, string>>;

async function openGarageRoy() {
  const api = installFakeApi({ signedInAs: pierre });
  renderDashboard({ path: `/lots/${garageRoy.id}` });
  await screen.findByRole('heading', { level: 1, name: 'Garage Roy' });
  return api;
}

async function typePricing(labels: typeof FRENCH_LABELS | typeof ENGLISH_LABELS, input: PricingInput) {
  for (const [field, value] of Object.entries(input) as [keyof typeof FRENCH_LABELS, string][]) {
    const box = screen.getByRole('textbox', { name: labels[field] });
    await userEvent.clear(box);
    if (value !== '') {
      await userEvent.type(box, value);
    }
  }
}

function savedPricingOfGarageRoy(api: Awaited<ReturnType<typeof openGarageRoy>>) {
  return api.lots.get(ROY_OPERATOR_ID)?.find(({ id }) => id === garageRoy.id)?.pricing;
}

function errorOf(field: keyof typeof FRENCH_LABELS): string | undefined {
  return document.getElementById(`pricing-${field}-error`)?.textContent?.replace(/\s/g, ' ');
}

describe('the pricing form, verification round after the merge of main (QA #64)', () => {
  it('saves the inclusive bounds typed in the form: 0,50 $ per 5 minutes, a cap equal to one increment and no guarantee', async () => {
    const api = await openGarageRoy();

    await typePricing(FRENCH_LABELS, { incrementCents: '0,50', incrementMinutes: '5', dailyCapCents: '0,50 $', holdQuota: '0' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la tarification' }));

    expect(await screen.findByText(/^Tarification enregistrée\./)).toBeDefined();
    expect(savedPricingOfGarageRoy(api)).toEqual({ incrementCents: 50, incrementMinutes: 5, dailyCapCents: 50, holdQuota: 0 });
  });

  it('saves the upper bounds typed in the form: 100 000,00 $ per 60 minutes and 50 guarantees', async () => {
    const api = await openGarageRoy();

    await typePricing(FRENCH_LABELS, { incrementCents: '100 000,00', incrementMinutes: '60', dailyCapCents: '100 000,00 $', holdQuota: '50' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la tarification' }));

    expect(await screen.findByText(/^Tarification enregistrée\./)).toBeDefined();
    expect(savedPricingOfGarageRoy(api)).toEqual({ incrementCents: 10_000_000, incrementMinutes: 60, dailyCapCents: 10_000_000, holdQuota: 50 });
  });

  it('translates every shown field error once the dashboard switches to English, and keeps what was typed', async () => {
    const api = await openGarageRoy();
    await typePricing(FRENCH_LABELS, { incrementCents: '-1', incrementMinutes: '61', dailyCapCents: '', holdQuota: '51' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la tarification' }));
    expect(errorOf('dailyCapCents')).toBe('Le plafond journalier est obligatoire');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(errorOf('incrementCents')).toBe('Enter an amount from $0.50 to $100,000.00.');
    expect(errorOf('incrementMinutes')).toBe('Enter a whole number of minutes, from 5 to 60.');
    expect(errorOf('dailyCapCents')).toBe('Daily cap is required');
    expect(errorOf('holdQuota')).toBe('Enter a whole number of guaranteed spots, from 0 to 50.');
    expect((screen.getByRole('textbox', { name: 'Price per increment' }) as HTMLInputElement).value).toBe('-1');
    expect(api.requests.some((request) => request.startsWith('PUT'))).toBe(false);
  });

  // Fails today: the English error prints "$100,000.00" as the largest cap, and the field refuses that same text.
  it('saves a cap typed "$100,000.00" in English, exactly as the cap error prints the largest amount', async () => {
    const api = await openGarageRoy();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await typePricing(ENGLISH_LABELS, { incrementCents: '1.00', incrementMinutes: '20', dailyCapCents: '$100,000.00', holdQuota: '4' });
    await userEvent.click(screen.getByRole('button', { name: 'Save the pricing' }));

    expect(errorOf('dailyCapCents')).toBeUndefined();
    expect(savedPricingOfGarageRoy(api)).toEqual({ incrementCents: 100, incrementMinutes: 20, dailyCapCents: 10_000_000, holdQuota: 4 });
  });

  // Fails today: an English operator writes eighteen hundred dollars "$1,800.00", which the field refuses.
  it('saves a cap typed "$1,800.00" in English as 180 000 cents', async () => {
    const api = await openGarageRoy();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await typePricing(ENGLISH_LABELS, { incrementCents: '1.00', incrementMinutes: '20', dailyCapCents: '$1,800.00', holdQuota: '4' });
    await userEvent.click(screen.getByRole('button', { name: 'Save the pricing' }));

    expect(errorOf('dailyCapCents')).toBeUndefined();
    expect(savedPricingOfGarageRoy(api)).toMatchObject({ dailyCapCents: 180_000 });
  });
});

describe('creating a lot, verification round after the merge of main (QA #64)', () => {
  // Fails today: the hint and the error write the largest capacity "10 000", and the field refuses "1 000".
  it('creates a lot with a capacity typed "1 000", the way the capacity hint writes its numbers', async () => {
    const api = installFakeApi({ signedInAs: pierre });
    renderDashboard({ path: '/lots/new' });
    await userEvent.type(await screen.findByLabelText('Nom'), 'Garage Roy Nord');
    await userEvent.type(screen.getByLabelText('Adresse'), '8000, boulevard Saint-Laurent, Montréal');
    await userEvent.type(screen.getByLabelText('Latitude (degrés décimaux)'), '45,54');
    await userEvent.type(screen.getByLabelText('Longitude (degrés décimaux)'), '-73,62');
    await userEvent.type(screen.getByLabelText('Capacité'), '1 000');
    expect(screen.getByText('Nombre de places, de 0 à 10 000.', { normalizer: (text) => text.replace(/\s/g, ' ') })).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Créer le stationnement' }));

    expect(document.getElementById('lot-capacity-error')).toBeNull();
    expect(api.requests).toContain('POST /lots');
  });
});

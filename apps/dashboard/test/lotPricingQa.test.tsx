import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, pierre } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const ROY_OPERATOR_ID = '00000000-0000-4000-8000-000000000102';

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

async function typePricing(input: PricingInput) {
  for (const [field, value] of Object.entries(input) as [keyof typeof LABELS, string][]) {
    const box = screen.getByRole('textbox', { name: LABELS[field] });
    await userEvent.clear(box);
    await userEvent.type(box, value);
  }
}

async function savePricing(input: PricingInput) {
  await typePricing(input);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la tarification' }));
}

function savedPricingOfGarageRoy(api: Awaited<ReturnType<typeof openGarageRoy>>) {
  return api.lots.get(ROY_OPERATOR_ID)?.find(({ id }) => id === garageRoy.id)?.pricing;
}

describe('the pricing form under hostile entry (QA #64)', () => {
  it('saves "$1.00" per 20 minutes and a cap typed "18,00 $" as 100 and 1800 cents', async () => {
    const api = await openGarageRoy();

    await savePricing({ incrementCents: '$1.00', incrementMinutes: '20', dailyCapCents: '18,00 $', holdQuota: '4' });

    expect(await screen.findByText('1,00 $ par 20 min')).toBeDefined();
    expect(savedPricingOfGarageRoy(api)).toEqual({ incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 });
  });

  it('shows the error of every C4 field at once, a cap of 0,49 $ included, and saves nothing', async () => {
    const api = await openGarageRoy();

    await savePricing({ incrementCents: '-1,00', incrementMinutes: '4', dailyCapCents: '0,49', holdQuota: '51' });

    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(4);
    expect(document.getElementById('pricing-dailyCapCents-error')?.textContent?.replace(/\s/g, ' ')).toBe('Entrez un plafond de 0,50 $ à 100 000,00 $.');
    expect(api.requests.some((request) => request.startsWith('PUT'))).toBe(false);
  });

  it('withdraws the saved confirmation once the pricing is edited and not saved again', async () => {
    await openGarageRoy();
    await savePricing({ incrementCents: '1,00', incrementMinutes: '20', dailyCapCents: '18,00', holdQuota: '4' });
    expect(await screen.findByText(/^Tarification enregistrée\./)).toBeDefined();

    await typePricing({ dailyCapCents: '25,00' });

    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('shows the saved amounts with a point once the dashboard switches to English', async () => {
    await openGarageRoy();
    await savePricing({ incrementCents: '1,00', incrementMinutes: '20', dailyCapCents: '18,00', holdQuota: '4' });
    await screen.findByText('1,00 $ par 20 min');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect((screen.getByRole('textbox', { name: 'Price per increment' }) as HTMLInputElement).value).toBe('1.00');
    expect((screen.getByRole('textbox', { name: 'Daily cap' }) as HTMLInputElement).value).toBe('18.00');
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parkingDemo, sophie } from './fakeDashboardApi.ts';
import { openPublicationOf, plainText } from './publicationPageSteps.ts';

function onlineStatus(): string {
  const section = screen.getByRole('heading', { level: 2, name: /^(État|State)$/ }).closest('section') as HTMLElement;
  return plainText(within(section).getByRole('status'));
}

describe('the go-live action', () => {
  it('keeps the focus on the one button and announces each change of state', async () => {
    await openPublicationOf(sophie, parkingDemo);
    const button = screen.getByRole('button', { name: 'Mettre en ligne' });
    expect(onlineStatus()).toBe('Le stationnement est hors ligne.');

    await userEvent.click(button);

    expect(await screen.findByRole('button', { name: 'Mettre hors ligne' })).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(onlineStatus()).toBe('Le stationnement est en ligne.');

    await userEvent.click(button);

    expect(await screen.findByRole('button', { name: 'Mettre en ligne' })).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(onlineStatus()).toBe('Le stationnement est hors ligne.');
  });

  it('announces the state in English', async () => {
    await openPublicationOf(sophie, parkingDemo);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Put online' }));

    expect(await screen.findByRole('button', { name: 'Take offline' })).toBeDefined();
    expect(onlineStatus()).toBe('The parking lot is online.');
  });
});

describe('the checklist details', () => {
  it('sets each count, amount, day and time as a mono figure, and nothing else', async () => {
    await openPublicationOf(sophie, parkingDemo);

    const figures = [...document.querySelectorAll('.checklist-detail .figure')].map((figure) => plainText(figure as HTMLElement));

    expect(figures).toEqual(['25,00 $', '10', '9', '12 novembre 2026', '12 novembre 2026', '14 nov., 15 h 30', '14 nov., 15 h 30']);
  });
});

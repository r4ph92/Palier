import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { PARKING_DEMO_B2_ID } from './fakeSpotData.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/spots-to-check`;
const rowOf = (number: string): HTMLElement => screen.getByRole('rowheader', { name: number }).closest('tr') as HTMLElement;

async function clickWhileTheClearRuns(language: 'Français' | 'English', buttonName: string): Promise<void> {
  const api = installFakeApi({ signedInAs: sophie });
  api.answers.set(`POST /lots/${parkingDemo.id}/spots/${PARKING_DEMO_B2_ID}/check-cleared`, 'pending');
  renderDashboard({ path: PAGE });
  await screen.findByRole('table');
  if (language === 'English') {
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
  }
  await userEvent.click(await screen.findByRole('button', { name: buttonName }));
}

describe('the spots to check page while a clear runs', () => {
  it('shows Vérification… beside the button, hidden from screen readers, and keeps the button’s name', async () => {
    await clickWhileTheClearRuns('Français', 'Place B-2 vérifiée');

    const busyWord = within(rowOf('B-2')).getByText('Vérification…');
    expect(busyWord.getAttribute('aria-hidden')).toBe('true');
    expect(rowOf('B-2').getAttribute('aria-busy')).toBe('true');
    expect(within(rowOf('B-2')).getByRole('button', { name: 'Place B-2 vérifiée' }).textContent).toBe('Vérifiée');
    expect(within(rowOf('A-1')).queryByText('Vérification…')).toBeNull();
  });

  it('says in the status line which spot is being checked', async () => {
    await clickWhileTheClearRuns('Français', 'Place B-2 vérifiée');

    expect(screen.getByRole('status').textContent).toBe('Vérification de la place B-2…');
  });

  it('shows Checking… and the status line in English', async () => {
    await clickWhileTheClearRuns('English', 'Spot B-2 checked');

    expect(within(rowOf('B-2')).getByText('Checking…').getAttribute('aria-hidden')).toBe('true');
    expect(within(rowOf('B-2')).getByRole('button', { name: 'Spot B-2 checked' }).textContent).toBe('Checked');
    expect(screen.getByRole('status').textContent).toBe('Checking spot B-2…');
  });
});

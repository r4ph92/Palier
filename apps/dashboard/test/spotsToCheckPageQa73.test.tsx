import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/spots-to-check`;
const FIVE_COLUMN_MINIMUM_PIXELS = 640;
const themeCss = ['layout.css', 'lists.css', 'map.css'].map((file) => readFileSync(resolve(import.meta.dirname, '../src/theme', file), 'utf8')).join('\n');

const rowOf = (number: string): HTMLElement => screen.getByRole('rowheader', { name: number }).closest('tr') as HTMLElement;

function maxWidthOfClass(className: string): number | null {
  const rule = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(themeCss)?.[1] ?? '';
  const pixels = /max-width:\s*(\d+)px/.exec(rule)?.[1];
  return pixels === undefined ? null : Number(pixels);
}

describe('the spots to check page under attack (QA #73)', () => {
  it('does not keep saying the previous spot was checked once the next click is refused', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });
    await userEvent.click(await screen.findByRole('button', { name: 'Place B-2 vérifiée' }));
    await screen.findByText('Place B-2 vérifiée.');

    await userEvent.click(screen.getByRole('button', { name: 'Place A-1 vérifiée' }));

    await within(rowOf('A-1')).findByRole('alert');
    expect(screen.queryByText('Place B-2 vérifiée.')).toBeNull();
  });

  it('gives its five French columns more room than the 480 px box made for the occupancy level table', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: PAGE });
    const table = await screen.findByRole('table');

    const capped = (table.parentElement?.className ?? '').split(' ').map((className) => maxWidthOfClass(className)).filter((width): width is number => width !== null);

    expect(capped.every((width) => width >= FIVE_COLUMN_MINIMUM_PIXELS)).toBe(true);
  });
});

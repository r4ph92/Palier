import type { DashboardSpotToCheck } from '@palier/shared-types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/spots-to-check`;
const spotsToCheckCss = readFileSync(resolve(import.meta.dirname, '../src/theme/spotsToCheck.css'), 'utf8');
// Measured live in round 2 (Chrome, FR, Parking Démo with « Retenue par une session »): the unwrapped table is 767 px wide, plus the 16 px gutters.
const FRENCH_TABLE_MINIMUM_VIEWPORT_PIXELS = 767 + 2 * 16;

function flagged(number: string, minute: number): DashboardSpotToCheck {
  return {
    spotId: `00000000-0000-4000-8000-0000000093${String(minute).padStart(2, '0')}`,
    number,
    levelCode: 'P1',
    aisleCode: number.slice(0, 1),
    since: `2026-11-13T14:${String(minute).padStart(2, '0')}:00.000Z`,
    reason: 'REPORTED_TAKEN',
    state: 'AVAILABLE',
    clearable: true,
  };
}

function stackingBreakpointPixels(): number {
  const pixels = /@media \(max-width:\s*(\d+)px\)\s*\{\s*\.check-table/.exec(spotsToCheckCss)?.[1];
  return pixels === undefined ? 0 : Number(pixels);
}

describe('the spots to check page under attack, round 2 (QA #73)', () => {
  it('keeps focus in the list when the row after the cleared one was cleared from another tab meanwhile', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const [first, second, third] = [flagged('A-1', 1), flagged('A-3', 2), flagged('B-4', 3)];
    api.spotsToCheck.set(parkingDemo.id, [first, second, third]);
    renderDashboard({ path: PAGE });
    await screen.findByRole('table');
    api.spotsToCheck.set(parkingDemo.id, [first, third]);

    await userEvent.click(screen.getByRole('button', { name: 'Place A-1 vérifiée' }));
    await screen.findByText('Place A-1 vérifiée.');

    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Place B-4 vérifiée' }));
  });

  it('stacks the French rows wherever the unwrapped table is wider than the page, so the page never scrolls sideways', () => {
    const scrollsInItsOwnBox = /\.check-table[^{]*\{[^}]*overflow-x:\s*auto/.test(spotsToCheckCss);

    expect(scrollsInItsOwnBox || stackingBreakpointPixels() >= FRENCH_TABLE_MINIMUM_VIEWPORT_PIXELS).toBe(true);
  });
});

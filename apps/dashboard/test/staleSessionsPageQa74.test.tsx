import type { DashboardStaleSession } from '@palier/shared-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { JULIE_STALE_SESSION_ID } from './fakeStaleSessionData.ts';
import { renderDashboard } from './renderDashboard.tsx';

const PAGE = `/lots/${parkingDemo.id}/stale-sessions`;
const PRESENCE_REQUEST = `POST /lots/${parkingDemo.id}/stale-sessions/${JULIE_STALE_SESSION_ID}/presence`;
const HOSTILE_PLATE = '<img src=x onerror=alert(1)>';

function flaggedSession(index: number, plate = `QA${String(index).padStart(4, '0')}`): DashboardStaleSession {
  return {
    id: `00000000-0000-4000-8000-${String(7400 + index).padStart(12, '0')}`,
    plate,
    spot: { number: `A-${index}`, levelCode: 'P1', aisleCode: 'A' },
    lastProofAt: '2026-11-09T02:10:51.999Z',
    lastProofKind: 'PARKED_ON_FOOT',
    flaggedAt: '2026-11-16T02:10:52.000Z',
  };
}

async function openWith(sessions?: DashboardStaleSession[]) {
  const api = installFakeApi({ signedInAs: sophie });
  if (sessions !== undefined) {
    api.staleSessions.set(parkingDemo.id, sessions);
  }
  renderDashboard({ path: PAGE });
  await screen.findByRole('table');
  return api;
}

describe('QA #74: the sessions with no exit page, attacked', () => {
  it('sends one presence check for a double click on Véhicule présent', async () => {
    const api = await openWith();
    const button = screen.getByRole('button', { name: 'Véhicule présent, JTR 482' });

    await userEvent.dblClick(button);
    await screen.findByText(/Présence du véhicule JTR 482 confirmée/);

    expect(api.requests.filter((request) => request === PRESENCE_REQUEST)).toHaveLength(1);
  });

  it('shows a plate holding HTML as text, never as markup', async () => {
    await openWith([flaggedSession(1, HOSTILE_PLATE)]);

    expect(screen.getByRole('link', { name: HOSTILE_PLATE })).toBeDefined();
    expect(document.querySelector('main img')).toBeNull();
    expect(screen.getByRole('button', { name: `Véhicule présent, ${HOSTILE_PLATE}` })).toBeDefined();
  });
});

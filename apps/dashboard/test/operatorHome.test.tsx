import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { installFakeApi, sophie } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

describe('operator home while the lots load', () => {
  it('announces the loading, then shows two placeholder rows once 300 ms have passed', async () => {
    installFakeApi({ signedInAs: sophie, answers: { 'GET /lots': 'pending' } });
    const { container } = renderDashboard();
    await screen.findByRole('heading', { level: 1, name: 'Stationnements Lavoie inc.' });

    expect(screen.getByRole('status').textContent).toBe('Chargement des stationnements…');
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(0);

    await waitFor(() => expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2));
    expect(screen.getByRole('status').textContent).toBe('Chargement des stationnements…');
  });
});

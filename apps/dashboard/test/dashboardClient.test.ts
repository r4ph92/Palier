import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardClient } from '../src/api/dashboardClient.ts';

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('dashboard client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('signs out with a POST that carries the dashboard header and no body', async () => {
    const fetchMock = stubFetch(204);

    await dashboardClient.signOut();

    expect(fetchMock).toHaveBeenCalledWith('/v1/dashboard/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-requested-with': 'palier-dashboard' },
      body: null,
    });
  });

  it('reads the lots with a GET that carries no dashboard header', async () => {
    const fetchMock = stubFetch(200, []);

    await dashboardClient.lots();

    expect(fetchMock).toHaveBeenCalledWith('/v1/dashboard/lots', { method: 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } });
  });

  it('saves pricing with a PUT that carries the dashboard header and the JSON body', async () => {
    const fetchMock = stubFetch(200, {});
    const pricing = { incrementCents: 100, incrementMinutes: 20, dailyCapCents: 1800, holdQuota: 4 };

    await dashboardClient.setLotPricing('lot/1', pricing);

    expect(fetchMock).toHaveBeenCalledWith('/v1/dashboard/lots/lot%2F1/pricing', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-requested-with': 'palier-dashboard', 'content-type': 'application/json' },
      body: JSON.stringify(pricing),
    });
  });
});

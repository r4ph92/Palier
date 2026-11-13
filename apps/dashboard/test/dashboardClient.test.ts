import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardClient } from '../src/api/dashboardClient.ts';

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('dashboard client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('signs out with a POST that carries the dashboard header and no body', async () => {
    const fetchMock = stubFetch(204);

    await dashboardClient.signOut();

    expect(fetchMock).toHaveBeenCalledWith('/v1/dashboard/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-requested-with': 'palier-dashboard' },
      body: null,
      signal: expect.any(AbortSignal),
    });
  });

  it('reads the lots with a GET that carries no dashboard header', async () => {
    const fetchMock = stubFetch(200, []);

    await dashboardClient.lots();

    expect(fetchMock).toHaveBeenCalledWith('/v1/dashboard/lots', { method: 'GET', credentials: 'same-origin', headers: { accept: 'application/json' }, signal: expect.any(AbortSignal) });
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
      signal: expect.any(AbortSignal),
    });
  });

  it('gives up on a request that gets no answer, so a hung poll fails instead of waiting forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const outcome = dashboardClient.lots().then(() => 'answered', () => 'failed');

    await vi.advanceTimersByTimeAsync(25_000);

    expect(await outcome).toBe('failed');
  });
});

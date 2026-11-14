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

  it('never aborts a write, which may still commit on the server', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      signal = init.signal;
      return new Promise(() => undefined);
    });
    void dashboardClient.createOperator('Stationnements Tremblay');

    await vi.advanceTimersByTimeAsync(60_000);

    expect(signal?.aborted).toBe(false);
  });

  it('deletes a spot with a DELETE on its own path, and keeps only the text values of a refusal', async () => {
    const fetchMock = stubFetch(409, { statusCode: 409, error: 'SPOT_NUMBER_TAKEN', values: { number: 'A-3', count: 3, other: { nested: true } } });

    const refusal = await dashboardClient.deleteSpot('lot/1', 'spot 7').catch((failure: unknown) => failure);

    expect(fetchMock.mock.calls[0]).toEqual(['/v1/dashboard/lots/lot%2F1/spots/spot%207', expect.objectContaining({ method: 'DELETE' })]);
    expect(refusal).toMatchObject({ status: 409, code: 'SPOT_NUMBER_TAKEN', values: { number: 'A-3' } });
    expect(Object.keys((refusal as { values: object }).values)).toEqual(['number']);
  });
});

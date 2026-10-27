import { describe, expect, it, vi } from 'vitest';
import { createGateApi } from '../../src/http/demo/gateApi.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const pressedAt = new Date('2026-10-27T22:02:00Z');
const recordedEntry = { gateId: 'gate-501', lotId: 'lot-201', kind: 'ENTRY', closedAt: pressedAt.toISOString(), vehicleCount: 1 };

describe('createGateApi', () => {
  it('sends the key as a Bearer header and the loop time as JSON', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(Response.json(recordedEntry));

    const response = await createGateApi(fetchFunction).postPassage(DEVICE_KEY, 'gate-501', pressedAt.toISOString());

    expect(response).toEqual({ status: 200, body: recordedEntry });
    expect(fetchFunction).toHaveBeenCalledWith('/v1/gates/gate-501/passage', {
      method: 'POST',
      headers: { authorization: `Bearer ${DEVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ closedAt: pressedAt.toISOString() }),
      cache: 'no-store',
      credentials: 'omit',
    });
  });

  it('reports the status of a refusal', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 401, body: null });
  });

  it('reports no body when a success answer is not JSON', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>proxy</html>', { status: 200 }));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 200, body: null });
  });

  it('reports status 0 when the API cannot be reached', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 0, body: null });
  });
});

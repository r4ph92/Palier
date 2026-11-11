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

  it('sends the reading as the identifier of the gate named in the path', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ outcome: 'fallback', identification: null }));

    const response = await createGateApi(fetchFunction).postIdentify(DEVICE_KEY, 'gate-502', 'abc 123');

    expect(response).toEqual({ status: 200, body: { outcome: 'fallback', identification: null } });
    expect(fetchFunction).toHaveBeenCalledWith('/v1/gates/gate-502/identify', {
      method: 'POST',
      headers: { authorization: `Bearer ${DEVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'abc 123' }),
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

  it('asks for the gate commands after a cursor, with the key as a Bearer header', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));

    await createGateApi(fetchFunction).fetchCommands(DEVICE_KEY, { issuedAt: '2026-10-27T22:02:00.000Z', id: '00000000-0000-4000-8000-000000000c01' });

    expect(fetchFunction).toHaveBeenCalledWith('/v1/gates/me/commands?after=2026-10-27T22%3A02%3A00.000Z&afterId=00000000-0000-4000-8000-000000000c01', {
      headers: { authorization: `Bearer ${DEVICE_KEY}` },
      cache: 'no-store',
      credentials: 'omit',
    });
  });

  it('asks for the latest gate commands without a cursor', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));

    await createGateApi(fetchFunction).fetchCommands(DEVICE_KEY, null);

    expect(fetchFunction.mock.calls[0]?.[0]).toBe('/v1/gates/me/commands');
  });
});

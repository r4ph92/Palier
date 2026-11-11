import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { ONLINE, toggleOffline, type Connection } from '../../src/http/demo/offlineControls.js';
import { restoredConnection } from '../../src/http/demo/queueStorage.js';

const STORAGE_KEY = 'palier.demoConsole.offlineQueue';
const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const item = { id: 'abcdef12-3456-4789-8abc-def123456789', kind: 'ENTRY', closedAt: '2026-11-01T14:00:00.000Z' };
const reloadedQueue: Connection = { kind: 'offline', queue: { gateId: entreeDemo.id, gateName: entreeDemo.name, kind: 'ENTRY', items: [item as never] } };

function storageHolding(value: string) {
  return { getItem: (key: string) => (key === STORAGE_KEY ? value : null), setItem: () => undefined, removeItem: () => undefined };
}

function apiAnswering(identity: ApiResponse) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    replayPassages: vi.fn<GateApi['replayPassages']>(),
  };
}

describe('a tampered or corrupted saved queue', () => {
  it.each([
    ['text that is not JSON', '{not json'],
    ['a queue of an unknown kind', JSON.stringify({ gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'BOGUS', items: [] })],
    ['items that are not a list', JSON.stringify({ gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'ENTRY', items: 'x' })],
    ['an item without an id', JSON.stringify({ gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'ENTRY', items: [{ kind: 'ENTRY', closedAt: 'x' }] })],
    ['a queue without a gate', JSON.stringify({ gateName: 'x', kind: 'ENTRY', items: [] })],
    ['a queue without the gate name', JSON.stringify({ gateId: 'gate-701', kind: 'ENTRY', items: [] })],
    ['a bare list', JSON.stringify([item])],
  ])('restarts the console online with %s', (_case, stored) => {
    expect(restoredConnection(storageHolding(stored))).toEqual(ONLINE);
  });
});

describe('going back online after a reload with a refused key', () => {
  it('keeps the queue offline and replays nothing when Palier refuses the key, so the right key can still replay it', async () => {
    const api = apiAnswering({ status: 401, body: null });

    const patch = await toggleOffline({ connection: reloadedQueue, deviceKey: DEVICE_KEY, identity: null }, api);

    expect(patch).toEqual({ identity: null, message: { key: 'replayKeyRefused', isError: true } });
    expect(api.replayPassages).not.toHaveBeenCalled();
  });

  it('keeps the queue when Palier cannot be reached to identify the gate', async () => {
    const api = apiAnswering({ status: 0, body: null });

    const patch = await toggleOffline({ connection: reloadedQueue, deviceKey: DEVICE_KEY, identity: null }, api);

    expect(patch.connection).toBeUndefined();
    expect(patch.message).toEqual({ key: 'replayUnreachable', isError: true });
    expect(api.replayPassages).not.toHaveBeenCalled();
  });
});

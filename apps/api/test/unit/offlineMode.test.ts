import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { MAXIMUM_REPLAY_BATCH } from '../../src/http/schemas/gateSchemas.ts';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { offlineStatusKey, pressLoopOffline, REPLAY_BATCH_SIZE, replayQueue, startQueue, type OfflineQueue } from '../../src/http/demo/offlineMode.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const firstPress = new Date('2026-11-01T14:00:00Z');
const secondPress = new Date('2026-11-01T14:03:00Z');

function emptyQueue(identity: GateIdentity): OfflineQueue {
  return startQueue(identity);
}

function exitQueueOfTwo(): OfflineQueue {
  return pressLoopOffline(pressLoopOffline(emptyQueue(sortieDemo), 'EXIT', firstPress), 'EXIT', secondPress);
}

function fakeApi(replay: ApiResponse = { status: 200, body: { counted: 2, duplicates: 0, vehicleCount: 3 } }) {
  return { replayPassages: vi.fn<GateApi['replayPassages']>().mockResolvedValue(replay) };
}

describe('offlineStatusKey', () => {
  it('refuses Palier users at an entry gate (C1, C6)', () => {
    expect(offlineStatusKey('ENTRY')).toBe('offlineEntryRefused');
  });

  it('opens an exit gate unconditionally (C2)', () => {
    expect(offlineStatusKey('EXIT')).toBe('offlineExitOpened');
  });
});

describe('startQueue', () => {
  it('starts an empty queue bound to the gate and its kind', () => {
    expect(startQueue(entreeDemo)).toEqual({ gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'ENTRY', items: [] });
  });
});

describe('REPLAY_BATCH_SIZE', () => {
  it('is the largest batch the server accepts', () => {
    expect(REPLAY_BATCH_SIZE).toBe(MAXIMUM_REPLAY_BATCH);
  });
});

describe('pressLoopOffline', () => {
  it('queues the passage with its own id and its original time, in order (C1, C2)', () => {
    const queue = exitQueueOfTwo();

    expect(queue.items.map((item) => item.closedAt)).toEqual([firstPress.toISOString(), secondPress.toISOString()]);
    expect(queue.items.map((item) => item.kind)).toEqual(['EXIT', 'EXIT']);
    expect(queue.items.every((item) => UUID_SHAPE.test(item.id))).toBe(true);
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(2);
  });

  it('ignores a loop of the other kind', () => {
    const queue = emptyQueue(sortieDemo);

    expect(pressLoopOffline(queue, 'ENTRY', firstPress)).toBe(queue);
  });
});

describe('replayQueue', () => {
  it('sends the queued passages once with their original times and empties the queue (C3)', async () => {
    const api = fakeApi();
    const queue = exitQueueOfTwo();

    const outcome = await replayQueue(queue, DEVICE_KEY, api);

    expect(api.replayPassages).toHaveBeenCalledTimes(1);
    expect(api.replayPassages).toHaveBeenCalledWith(DEVICE_KEY, 'gate-702', queue.items);
    expect(outcome).toEqual({ queue: { ...queue, items: [] }, replayed: 2, vehicleCount: 3, failure: null });
  });

  it('retries a 200 without a readable body, since the ids count once', async () => {
    const outcome = await replayQueue(exitQueueOfTwo(), DEVICE_KEY, fakeApi({ status: 200, body: null }));

    expect(outcome.failure).toEqual({ messageKey: 'replayFailed', isRetryable: true });
  });

  it('sends nothing for an empty queue', async () => {
    const api = fakeApi();

    const outcome = await replayQueue(emptyQueue(sortieDemo), DEVICE_KEY, api);

    expect(api.replayPassages).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ replayed: 0, vehicleCount: null, failure: null });
  });

  it('chunks a long queue by 500 and clears only what was acknowledged', async () => {
    const items = Array.from({ length: 1200 }, (_, index) => ({ id: `id-${index}`, kind: 'EXIT' as const, closedAt: firstPress.toISOString() }));
    const api = fakeApi();

    const outcome = await replayQueue({ ...emptyQueue(sortieDemo), items }, DEVICE_KEY, api);

    expect(api.replayPassages.mock.calls.map(([, , batch]) => batch.length)).toEqual([500, 500, 200]);
    expect(outcome.replayed).toBe(1200);
  });

  it('keeps the unacknowledged batches when a later one fails', async () => {
    const items = Array.from({ length: 700 }, (_, index) => ({ id: `id-${index}`, kind: 'EXIT' as const, closedAt: firstPress.toISOString() }));
    const api = fakeApi();
    api.replayPassages.mockResolvedValueOnce({ status: 200, body: { counted: 500, duplicates: 0, vehicleCount: 1 } }).mockResolvedValueOnce({ status: 0, body: null });

    const outcome = await replayQueue({ ...emptyQueue(sortieDemo), items }, DEVICE_KEY, api);

    expect(outcome.queue.items).toEqual(items.slice(500));
    expect(outcome.failure).toEqual({ messageKey: 'replayUnreachable', isRetryable: true });
  });

  it.each([
    [0, 'replayUnreachable', true],
    [500, 'replayFailed', true],
    [503, 'replayFailed', true],
    [401, 'replayKeyRefused', false],
    [403, 'replayGateForbidden', false],
    [409, 'replayRefused', false],
    [400, 'replayRefused', false],
  ] as const)('on status %i shows %s and %s retryable', async (status, messageKey, isRetryable) => {
    const queue = exitQueueOfTwo();

    const outcome = await replayQueue(queue, DEVICE_KEY, fakeApi({ status, body: null }));

    expect(outcome.failure).toEqual({ messageKey, isRetryable });
    expect(outcome.queue).toEqual(queue);
  });
});


import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import type { ConsoleState } from '../../src/http/demo/consoleRender.js';
import { clearQueue, pressLoopWhileOffline, toggleOffline } from '../../src/http/demo/offlineControls.js';
import { goOffline, offlineStatusKey, pressLoopOffline, replayedMessage, replayQueue, type OfflineQueue } from '../../src/http/demo/offlineMode.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const firstPress = new Date('2026-11-01T14:00:00Z');
const secondPress = new Date('2026-11-01T14:03:00Z');

function emptyQueue(identity: GateIdentity): OfflineQueue {
  return { deviceKey: DEVICE_KEY, gateId: identity.id, kind: identity.kind, items: [] };
}

function exitQueueOfTwo(): OfflineQueue {
  return pressLoopOffline(pressLoopOffline(emptyQueue(sortieDemo), 'EXIT', firstPress), 'EXIT', secondPress);
}

function fakeApi(identity: ApiResponse = { status: 200, body: sortieDemo }, replay: ApiResponse = { status: 200, body: { counted: 2, duplicates: 0, vehicleCount: 3 } }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    replayPassages: vi.fn<GateApi['replayPassages']>().mockResolvedValue(replay),
  };
}

function consoleState(overrides: Partial<ConsoleState> = {}): ConsoleState {
  return {
    language: 'fr',
    deviceKey: DEVICE_KEY,
    identity: null,
    passages: [],
    commands: [],
    message: null,
    offline: false,
    pending: null,
    isQueueBlocked: false,
    renderedCommandLines: '',
    ...overrides,
  };
}

describe('offlineStatusKey', () => {
  it('refuses Palier users at an entry gate (C1, C6)', () => {
    expect(offlineStatusKey('ENTRY')).toBe('offlineEntryRefused');
  });

  it('opens an exit gate unconditionally (C2)', () => {
    expect(offlineStatusKey('EXIT')).toBe('offlineExitOpened');
  });
});

describe('goOffline', () => {
  it('identifies the gate while still online and starts an empty queue bound to it', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    const outcome = await goOffline({ deviceKey: DEVICE_KEY, identity: null }, api);

    expect(outcome).toEqual({ kind: 'offline', identity: entreeDemo, queue: emptyQueue(entreeDemo) });
  });

  it('reuses a known identity without asking again', async () => {
    const api = fakeApi();

    await goOffline({ deviceKey: DEVICE_KEY, identity: sortieDemo }, api);

    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('stays online with the reason when the gate cannot be identified', async () => {
    const outcome = await goOffline({ deviceKey: DEVICE_KEY, identity: null }, fakeApi({ status: 401, body: null }));

    expect(outcome).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
  });

  it('refuses a key that cannot be sent without asking Palier', async () => {
    const api = fakeApi();

    const outcome = await goOffline({ deviceKey: 'short', identity: null }, api);

    expect(outcome).toMatchObject({ kind: 'refused', messageKey: 'keyRefused' });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
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

    const outcome = await replayQueue(queue, api);

    expect(api.replayPassages).toHaveBeenCalledTimes(1);
    expect(api.replayPassages).toHaveBeenCalledWith(DEVICE_KEY, 'gate-702', queue.items);
    expect(outcome).toEqual({ queue: { ...queue, items: [] }, replayed: 2, vehicleCount: 3, failure: null });
  });

  it('sends nothing for an empty queue', async () => {
    const api = fakeApi();

    const outcome = await replayQueue(emptyQueue(sortieDemo), api);

    expect(api.replayPassages).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ replayed: 0, vehicleCount: null, failure: null });
  });

  it('chunks a long queue by 500 and clears only what was acknowledged', async () => {
    const items = Array.from({ length: 1200 }, (_, index) => ({ id: `id-${index}`, kind: 'EXIT' as const, closedAt: firstPress.toISOString() }));
    const api = fakeApi();

    const outcome = await replayQueue({ ...emptyQueue(sortieDemo), items }, api);

    expect(api.replayPassages.mock.calls.map(([, , batch]) => batch.length)).toEqual([500, 500, 200]);
    expect(outcome.replayed).toBe(1200);
  });

  it('keeps the unacknowledged batches when a later one fails', async () => {
    const items = Array.from({ length: 700 }, (_, index) => ({ id: `id-${index}`, kind: 'EXIT' as const, closedAt: firstPress.toISOString() }));
    const api = fakeApi();
    api.replayPassages.mockResolvedValueOnce({ status: 200, body: { counted: 500, duplicates: 0, vehicleCount: 1 } }).mockResolvedValueOnce({ status: 0, body: null });

    const outcome = await replayQueue({ ...emptyQueue(sortieDemo), items }, api);

    expect(outcome.queue.items).toEqual(items.slice(500));
    expect(outcome.failure).toEqual({ messageKey: 'unreachable', isRetryable: true });
  });

  it.each([
    [0, 'unreachable', true],
    [500, 'replayFailed', true],
    [503, 'replayFailed', true],
    [401, 'keyRefused', false],
    [403, 'gateForbidden', false],
    [409, 'replayFailed', false],
    [400, 'replayFailed', false],
  ] as const)('on status %i shows %s and %s retryable', async (status, messageKey, isRetryable) => {
    const queue = exitQueueOfTwo();

    const outcome = await replayQueue(queue, fakeApi(undefined, { status, body: null }));

    expect(outcome.failure).toEqual({ messageKey, isRetryable });
    expect(outcome.queue).toEqual(queue);
  });
});

describe('replayedMessage', () => {
  it('uses the singular for one passage and the plural otherwise', () => {
    expect(replayedMessage(1, 4).key).toBe('passagesReplayedOne');
    expect(replayedMessage(2, 4)).toEqual({ key: 'passagesReplayedOther', isError: false, count: 2, vehicleCount: 4 });
  });
});

describe('the offline console flow', () => {
  it('refuses an entry offline: status shown, one passage waiting, nothing sent (C1)', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });
    const state = consoleState();

    await toggleOffline(state, api);
    pressLoopWhileOffline(state, 'ENTRY');

    expect(state.offline).toBe(true);
    expect(state.message).toEqual({ key: 'offlineEntryRefused', isError: false });
    expect(state.pending?.items).toHaveLength(1);
    expect(api.replayPassages).not.toHaveBeenCalled();
  });

  it('opens the exit and queues two passages, still sending nothing (C2)', async () => {
    const api = fakeApi();
    const state = consoleState();

    await toggleOffline(state, api);
    pressLoopWhileOffline(state, 'EXIT');
    pressLoopWhileOffline(state, 'EXIT');

    expect(state.message).toEqual({ key: 'offlineExitOpened', isError: false });
    expect(state.pending?.items).toHaveLength(2);
    expect(api.replayPassages).not.toHaveBeenCalled();
  });

  it('replays the queue when switching back online and shows the new count (C3)', async () => {
    const api = fakeApi();
    const state = consoleState();
    await toggleOffline(state, api);
    pressLoopWhileOffline(state, 'EXIT');
    pressLoopWhileOffline(state, 'EXIT');
    const queued = state.pending?.items;

    await toggleOffline(state, api);

    expect(api.replayPassages).toHaveBeenCalledTimes(1);
    expect(api.replayPassages).toHaveBeenCalledWith(DEVICE_KEY, 'gate-702', queued);
    expect(state.offline).toBe(false);
    expect(state.pending?.items).toEqual([]);
    expect(state.message).toEqual({ key: 'passagesReplayedOther', isError: false, count: 2, vehicleCount: 3 });
  });

  it('stays offline with the queue when the replay cannot reach Palier, and a retry sends it again', async () => {
    const api = fakeApi();
    const state = consoleState();
    await toggleOffline(state, api);
    pressLoopWhileOffline(state, 'EXIT');
    api.replayPassages.mockResolvedValueOnce({ status: 0, body: null });

    await toggleOffline(state, api);

    expect(state.offline).toBe(true);
    expect(state.pending?.items).toHaveLength(1);
    expect(state.isQueueBlocked).toBe(false);
    expect(state.message).toEqual({ key: 'unreachable', isError: true });

    await toggleOffline(state, api);

    expect(state.offline).toBe(false);
  });

  it('offers to clear the queue after a refusal, which goes back online and frees the key', async () => {
    const api = fakeApi();
    const state = consoleState();
    await toggleOffline(state, api);
    pressLoopWhileOffline(state, 'EXIT');
    api.replayPassages.mockResolvedValueOnce({ status: 409, body: null });

    await toggleOffline(state, api);
    expect(state.isQueueBlocked).toBe(true);
    clearQueue(state);

    expect(state).toMatchObject({ offline: false, pending: null, isQueueBlocked: false, message: null });
  });

  it('does not go offline when the gate cannot be identified', async () => {
    const state = consoleState();

    await toggleOffline(state, fakeApi({ status: 0, body: null }));

    expect(state.offline).toBe(false);
    expect(state.message).toEqual({ key: 'unreachable', isError: true });
  });
});

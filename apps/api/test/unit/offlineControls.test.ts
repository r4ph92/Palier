import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import {
  clearQueue,
  focusTargetAfterQueueAction,
  hasPendingPassages,
  isLoopAvailable,
  isToggleAvailable,
  ONLINE,
  pressLoopWhileOffline,
  statusMessageOf,
  toggleOffline,
  type Connection,
} from '../../src/http/demo/offlineControls.js';
import { isReaderEnabled } from '../../src/http/demo/readerRead.js';
import { isPresenceEnabled } from '../../src/http/demo/vehiclePresence.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const PRESSED_AT = new Date('2026-11-01T14:00:00Z');
const REPLAYED: ApiResponse = { status: 200, body: { counted: 2, duplicates: 0, vehicleCount: 3 } };

function fakeApi(identity: ApiResponse = { status: 200, body: sortieDemo }, replay: ApiResponse = REPLAYED) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    replayPassages: vi.fn<GateApi['replayPassages']>().mockResolvedValue(replay),
  };
}

function offlineWith(identity: GateIdentity, passages: number): Connection {
  let connection: Connection = { kind: 'offline', queue: { gateId: identity.id, gateName: identity.name, kind: identity.kind, items: [] } };
  for (let press = 0; press < passages; press += 1) {
    connection = { ...connection, ...pressLoopWhileOffline(connection, identity.kind, PRESSED_AT).connection };
  }
  return connection;
}

function request(connection: Connection, identity: GateIdentity | null = null) {
  return { connection, deviceKey: DEVICE_KEY, identity };
}

describe('going offline', () => {
  it('identifies the gate while still online, then refuses Palier users at an entry (C1)', async () => {
    const patch = await toggleOffline(request(ONLINE), fakeApi({ status: 200, body: entreeDemo }));

    expect(patch.connection).toEqual({ kind: 'offline', queue: { gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'ENTRY', items: [] } });
    expect(patch.message).toEqual({ key: 'offlineEntryRefused', isError: false, tone: 'degraded' });
    expect(patch.identity).toEqual(entreeDemo);
  });

  it('opens an exit unconditionally with the muted tone (C2)', async () => {
    const patch = await toggleOffline(request(ONLINE), fakeApi());

    expect(patch.message).toEqual({ key: 'offlineExitOpened', isError: false, tone: 'muted' });
  });

  it('stays online with the reason when the gate cannot be identified', async () => {
    const patch = await toggleOffline(request(ONLINE), fakeApi({ status: 0, body: null }));

    expect(patch).toEqual({ identity: null, message: { key: 'unreachable', isError: true } });
  });
});

describe('counting while offline', () => {
  it('queues each press of the gate loop, sending nothing (C1, C2)', () => {
    const first = pressLoopWhileOffline(offlineWith(sortieDemo, 0), 'EXIT', PRESSED_AT);
    const second = pressLoopWhileOffline(first.connection as Connection, 'EXIT', PRESSED_AT);

    expect(hasPendingPassages(second.connection as Connection)).toBe(true);
    expect(second.connection).toMatchObject({ kind: 'offline', queue: { items: [{ closedAt: PRESSED_AT.toISOString() }, { closedAt: PRESSED_AT.toISOString() }] } });
    expect(second.message).toMatchObject({ key: 'offlineExitOpened' });
  });

  it('changes nothing while online or blocked', () => {
    const blocked: Connection = { kind: 'blocked', queue: { gateId: 'gate-702', gateName: 'Sortie Démo', kind: 'EXIT', items: [] }, refusal: 'replayRefused' };

    expect(pressLoopWhileOffline(ONLINE, 'EXIT', PRESSED_AT)).toEqual({});
    expect(pressLoopWhileOffline(blocked, 'EXIT', PRESSED_AT)).toEqual({});
  });
});

describe('going back online', () => {
  it('replays the queue and reports the new count (C3)', async () => {
    const api = fakeApi();
    const connection = offlineWith(sortieDemo, 2);

    const patch = await toggleOffline(request(connection, sortieDemo), api);

    expect(api.replayPassages).toHaveBeenCalledTimes(1);
    expect(patch.connection).toEqual({ kind: 'online', hasReplayed: true });
    expect(patch.message).toEqual({ replayed: { count: 2, vehicleCount: 3 }, isError: false });
  });

  it('identifies the gate first after a reload, then replays', async () => {
    const api = fakeApi();

    const patch = await toggleOffline(request(offlineWith(sortieDemo, 1)), api);

    expect(api.fetchIdentity).toHaveBeenCalledTimes(1);
    expect(patch.connection).toEqual({ kind: 'online', hasReplayed: true });
  });

  it('blocks the queue when the key belongs to another gate, replaying nothing', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    const patch = await toggleOffline(request(offlineWith(sortieDemo, 1)), api);

    expect(api.replayPassages).not.toHaveBeenCalled();
    expect(patch).toMatchObject({ identity: null, connection: { kind: 'blocked' }, message: { key: 'replayGateForbidden' } });
  });

  it('stays offline and retryable when Palier is unreachable, and a retry then goes online', async () => {
    const api = fakeApi();
    api.replayPassages.mockResolvedValueOnce({ status: 0, body: null });
    const connection = offlineWith(sortieDemo, 1);

    const failed = await toggleOffline(request(connection, sortieDemo), api);
    const retried = await toggleOffline(request(failed.connection as Connection, sortieDemo), api);

    expect(failed).toMatchObject({ connection: { kind: 'offline' }, message: { key: 'replayUnreachable', isError: true } });
    expect(retried.connection).toEqual({ kind: 'online', hasReplayed: true });
  });

  it('blocks the queue after a refusal and frees the key; a later success leaves nothing blocked', async () => {
    const api = fakeApi();
    api.replayPassages.mockResolvedValueOnce({ status: 409, body: null });

    const refused = await toggleOffline(request(offlineWith(sortieDemo, 1), sortieDemo), api);
    const retried = await toggleOffline(request(refused.connection as Connection), api);

    expect(refused).toMatchObject({ identity: null, connection: { kind: 'blocked' }, message: { key: 'replayRefused' } });
    expect(retried.connection).toEqual({ kind: 'online', hasReplayed: true });
  });

  it('clears a blocked queue back to online, announcing it', () => {
    expect(clearQueue()).toEqual({ connection: ONLINE, message: { key: 'queueCleared', isError: false } });
  });
});

describe('which controls work', () => {
  const offline = offlineWith(sortieDemo, 0);

  it('lets only the loop of the gate count while offline, even before a key is entered after a reload', () => {
    const state = { connection: offline, deviceKey: '', identity: null };

    expect(isLoopAvailable('EXIT', state)).toBe(true);
    expect(isLoopAvailable('ENTRY', state)).toBe(false);
  });

  it('disables every loop while the queue is blocked', () => {
    const state = { connection: { kind: 'blocked', queue: { gateId: 'g', gateName: 'g', kind: 'EXIT', items: [] }, refusal: 'replayRefused' } as Connection, deviceKey: DEVICE_KEY, identity: sortieDemo };

    expect(isLoopAvailable('EXIT', state)).toBe(false);
  });

  it('follows the key and the gate while online', () => {
    expect(isLoopAvailable('EXIT', { connection: ONLINE, deviceKey: '', identity: null })).toBe(false);
    expect(isLoopAvailable('EXIT', { connection: ONLINE, deviceKey: DEVICE_KEY, identity: null })).toBe(true);
  });

  it('suspends the exit reader and the vehicle presence while offline, even at an exit gate', () => {
    const state = { deviceKey: DEVICE_KEY, identity: sortieDemo, isOffline: true };

    expect(isReaderEnabled(state)).toBe(false);
    expect(isPresenceEnabled(state)).toBe(false);
  });

  it('shows a status only while offline, and the refusal while blocked', () => {
    const blocked: Connection = { kind: 'blocked', queue: { gateId: 'g', gateName: 'g', kind: 'EXIT', items: [] }, refusal: 'replayRefused' };

    expect(statusMessageOf(ONLINE)).toBeNull();
    expect(statusMessageOf(blocked)).toEqual({ key: 'replayRefused', isError: true });
    expect(statusMessageOf(offline)).toMatchObject({ key: 'offlineExitOpened' });
  });
});

describe('going back online after a reload', () => {
  const reloaded = offlineWith(sortieDemo, 1);

  it.each([
    [401, 'replayKeyRefused'],
    [403, 'replayGateForbidden'],
    [0, 'replayUnreachable'],
    [409, 'replayFailed'],
    [500, 'replayFailed'],
  ])('words an identify failure %i as the replay key %s', async (status, expected) => {
    const patch = await toggleOffline(request(reloaded), fakeApi({ status, body: null }));

    expect(patch).toEqual({ identity: null, message: { key: expected, isError: true } });
  });

  it.each(['', 'short', `${DEVICE_KEY}!`])('asks for the gate key without any request when the key is "%s"', async (deviceKey) => {
    const api = fakeApi();

    const patch = await toggleOffline({ connection: reloaded, deviceKey, identity: null }, api);

    expect(patch).toEqual({ message: { key: 'replayKeyHint', isError: false } });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
    expect(api.replayPassages).not.toHaveBeenCalled();
  });

  it('keeps the refusal key on the blocked connection, so editing the key field keeps the explanation', async () => {
    const forbidden = await toggleOffline(request(reloaded), fakeApi({ status: 200, body: entreeDemo }));
    const refused = await toggleOffline(request(reloaded, sortieDemo), fakeApi(undefined, { status: 409, body: null }));

    expect(statusMessageOf(forbidden.connection as Connection)).toEqual({ key: 'replayGateForbidden', isError: true });
    expect(statusMessageOf(refused.connection as Connection)).toEqual({ key: 'replayRefused', isError: true });
  });
});

describe('the offline toggle and the focus', () => {
  const idle = { connection: ONLINE, deviceKey: DEVICE_KEY, isSending: false };

  it('acts when a key is entered or a queue is waiting, and never while sending', () => {
    expect(isToggleAvailable(idle)).toBe(true);
    expect(isToggleAvailable({ ...idle, deviceKey: '' })).toBe(false);
    expect(isToggleAvailable({ ...idle, deviceKey: '', connection: offlineWith(sortieDemo, 1) })).toBe(true);
    expect(isToggleAvailable({ ...idle, isSending: true })).toBe(false);
  });

  it('puts the focus on the key field after clearing a queue when no key is left, else on the toggle', () => {
    expect(focusTargetAfterQueueAction({ ...idle, deviceKey: '' })).toBe('deviceKey');
    expect(focusTargetAfterQueueAction(idle)).toBe('offlineToggle');
  });

  it('names the gate on the stored queue', () => {
    expect(offlineWith(sortieDemo, 0)).toMatchObject({ queue: { gateName: 'Sortie Démo' } });
  });
});

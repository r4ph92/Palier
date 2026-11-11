import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import {
  clearQueue,
  hasPendingPassages,
  isLoopAvailable,
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
  let connection: Connection = { kind: 'offline', queue: { gateId: identity.id, kind: identity.kind, items: [] } };
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

    expect(patch.connection).toEqual({ kind: 'offline', queue: { gateId: 'gate-701', kind: 'ENTRY', items: [] } });
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
    const blocked: Connection = { kind: 'blocked', queue: { gateId: 'gate-702', kind: 'EXIT', items: [] } };

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
    const state = { connection: { kind: 'blocked', queue: { gateId: 'g', kind: 'EXIT', items: [] } } as Connection, deviceKey: DEVICE_KEY, identity: sortieDemo };

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

  it('shows a status only while offline', () => {
    expect(statusMessageOf(ONLINE)).toBeNull();
    expect(statusMessageOf(offline)).toMatchObject({ key: 'offlineExitOpened' });
  });
});

import type { GateIdentity } from '@palier/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { createHeartbeat, HEARTBEAT_MILLISECONDS, scheduleHeartbeat, sendHeartbeat } from '../../src/http/demo/gateHeartbeat.js';

const ENTREE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const SORTIE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const entreeDemo: GateIdentity = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const ACCEPTED: ApiResponse = { status: 204, body: null };

interface ConsoleState {
  deviceKey: string;
  identity: GateIdentity | null;
  connection: { kind: string };
}

function fakeApi(heartbeat: ApiResponse = ACCEPTED, identity: ApiResponse = { status: 200, body: entreeDemo }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    postHeartbeat: vi.fn<GateApi['postHeartbeat']>().mockResolvedValue(heartbeat),
  };
}

function consoleState(deviceKey = ENTREE_KEY): ConsoleState {
  return { deviceKey, identity: null, connection: { kind: 'online' } };
}

describe('sendHeartbeat', () => {
  it('names the gate the key belongs to, then beats on its id', async () => {
    const api = fakeApi();

    expect(await sendHeartbeat({ deviceKey: ENTREE_KEY, identity: null }, api)).toEqual({ identity: entreeDemo, isKeyRefused: false });
    expect(api.postHeartbeat).toHaveBeenCalledWith(ENTREE_KEY, 'gate-501');
  });

  it.each([401, 403])('reports the key refused when the beat gets %i', async (status) => {
    expect(await sendHeartbeat({ deviceKey: ENTREE_KEY, identity: entreeDemo }, fakeApi({ status, body: null }))).toMatchObject({ isKeyRefused: true });
  });

  it('reports the key refused when Palier will not name its gate', async () => {
    const api = fakeApi(ACCEPTED, { status: 401, body: null });

    expect(await sendHeartbeat({ deviceKey: ENTREE_KEY, identity: null }, api)).toEqual({ identity: null, isKeyRefused: true });
    expect(api.postHeartbeat).not.toHaveBeenCalled();
  });

  it('keeps beating when Palier cannot be reached', async () => {
    expect(await sendHeartbeat({ deviceKey: ENTREE_KEY, identity: entreeDemo }, fakeApi({ status: 0, body: null }))).toMatchObject({ isKeyRefused: false });
  });
});

describe('the console heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('beats every 30 seconds while online, and keeps the gate it learnt', async () => {
    const api = fakeApi();
    const state = consoleState();
    const onIdentified = vi.fn();
    const timer = scheduleHeartbeat(createHeartbeat(state, api, onIdentified));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MILLISECONDS * 3);
    clearInterval(timer);

    expect(api.postHeartbeat).toHaveBeenCalledTimes(3);
    expect(api.fetchIdentity).toHaveBeenCalledTimes(1);
    expect(state.identity).toEqual(entreeDemo);
    expect(onIdentified).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while the console is offline, and beats at once on returning online', async () => {
    const api = fakeApi();
    const state = consoleState();
    state.connection = { kind: 'offline' };
    const heartbeat = createHeartbeat(state, api, vi.fn());
    const timer = scheduleHeartbeat(heartbeat);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MILLISECONDS * 2);
    expect(api.postHeartbeat).not.toHaveBeenCalled();
    state.connection = { kind: 'online' };
    await heartbeat.beat();
    clearInterval(timer);

    expect(api.postHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('beats at once when a well-formed key is typed, and never for a key that cannot be sent', async () => {
    const api = fakeApi();
    const state = consoleState('short');
    const heartbeat = createHeartbeat(state, api, vi.fn());

    await heartbeat.restart();
    expect(api.fetchIdentity).not.toHaveBeenCalled();
    state.deviceKey = ENTREE_KEY;
    await heartbeat.restart();

    expect(api.postHeartbeat).toHaveBeenCalledWith(ENTREE_KEY, 'gate-501');
  });

  it.each([401, 403])('stops after a %i and starts again once the key field changes', async (status) => {
    const api = fakeApi({ status, body: null });
    const state = consoleState();
    const heartbeat = createHeartbeat(state, api, vi.fn());
    const timer = scheduleHeartbeat(heartbeat);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MILLISECONDS * 3);
    expect(api.postHeartbeat).toHaveBeenCalledTimes(1);
    api.postHeartbeat.mockResolvedValue(ACCEPTED);
    await heartbeat.restart();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MILLISECONDS);
    clearInterval(timer);

    expect(api.postHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('drops the answer for a key the field no longer holds', async () => {
    let answerIdentity: (response: ApiResponse) => void = () => undefined;
    const api = fakeApi({ status: 401, body: null });
    api.fetchIdentity.mockReturnValueOnce(new Promise((resolve) => (answerIdentity = resolve)));
    const state = consoleState();
    const heartbeat = createHeartbeat(state, api, vi.fn());

    const firstBeat = heartbeat.beat();
    state.deviceKey = SORTIE_KEY;
    answerIdentity({ status: 200, body: entreeDemo });
    await firstBeat;

    expect(state.identity).toBeNull();
    api.postHeartbeat.mockResolvedValue(ACCEPTED);
    await heartbeat.beat();
    expect(api.postHeartbeat).toHaveBeenCalledTimes(2);
  });

  it('sends one beat at a time for the same key', async () => {
    const api = fakeApi();
    const state = consoleState();
    state.identity = entreeDemo;
    const heartbeat = createHeartbeat(state, api, vi.fn());

    await Promise.all([heartbeat.beat(), heartbeat.beat()]);

    expect(api.postHeartbeat).toHaveBeenCalledTimes(1);
  });
});

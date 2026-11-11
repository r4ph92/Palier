import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleState } from '../../src/http/demo/consoleRender.js';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { clearQueue, pressLoopWhileOffline, toggleOffline } from '../../src/http/demo/offlineControls.js';
import { isReaderEnabled } from '../../src/http/demo/readerRead.js';

const DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const REPLAYED: ApiResponse = { status: 200, body: { counted: 1, duplicates: 0, vehicleCount: 2 } };
const REFUSED: ApiResponse = { status: 409, body: null };

function fakeApi() {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue({ status: 200, body: sortieDemo }),
    replayPassages: vi.fn<GateApi['replayPassages']>().mockResolvedValue(REPLAYED),
  };
}

function consoleState(): ConsoleState {
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
  };
}

async function offlineWithOneExit(api: ReturnType<typeof fakeApi>): Promise<ConsoleState> {
  const state = consoleState();
  await toggleOffline(state, api);
  pressLoopWhileOffline(state, 'EXIT');
  return state;
}

describe('the offline console, edge cases found in QA', () => {
  it('suspends the exit reader while offline, even at an exit gate', async () => {
    const state = await offlineWithOneExit(fakeApi());

    expect(isReaderEnabled(state)).toBe(false);
  });

  it('hides "Vider la file" once a refused replay later goes through', async () => {
    const api = fakeApi();
    const state = await offlineWithOneExit(api);
    api.replayPassages.mockResolvedValueOnce(REFUSED);
    await toggleOffline(state, api);
    expect(state.isQueueBlocked).toBe(true);

    await toggleOffline(state, api);

    expect(state.offline).toBe(false);
    expect(state.pending?.items).toEqual([]);
    expect(state.isQueueBlocked).toBe(false);
  });

  it('keeps a queue cleared while a retry is in flight cleared, with the console online', async () => {
    const api = fakeApi();
    const state = await offlineWithOneExit(api);
    api.replayPassages.mockResolvedValueOnce(REFUSED);
    await toggleOffline(state, api);
    let answerRetry: (response: ApiResponse) => void = () => undefined;
    api.replayPassages.mockReturnValueOnce(new Promise((resolve) => (answerRetry = resolve)));

    const retry = toggleOffline(state, api);
    clearQueue(state);
    answerRetry(REFUSED);
    await retry;

    expect(state).toMatchObject({ offline: false, pending: null, isQueueBlocked: false });
  });
});

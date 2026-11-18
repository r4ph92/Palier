import type { GateIdentity, GatePassageResponse } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleMessage } from '../../src/http/demo/consoleText.js';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { createHeartbeat } from '../../src/http/demo/gateHeartbeat.js';
import { pressLoop } from '../../src/http/demo/loopPress.js';
import { ONLINE, isLoopAvailable, type Connection } from '../../src/http/demo/offlineControls.js';
import { applyPressOutcome } from '../../src/http/demo/pressOutcome.js';

const ENTREE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const SORTIE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const countedEntry: GatePassageResponse = {
  gateId: entreeDemo.id,
  lotId: 'lot-201',
  kind: 'ENTRY',
  closedAt: '2026-11-17T21:05:00.000Z',
  vehicleCount: 3,
  confirmedSessionId: null,
  exitedSessionId: null,
};

interface ConsoleState {
  deviceKey: string;
  identity: GateIdentity | null;
  passages: GatePassageResponse[];
  connection: Connection;
  message: ConsoleMessage | null;
}

function slowPassageApi() {
  let answerPassage: (response: ApiResponse) => void = () => undefined;
  const api = {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>((deviceKey) =>
      Promise.resolve({ status: 200, body: deviceKey === SORTIE_KEY ? sortieDemo : entreeDemo }),
    ),
    postHeartbeat: vi.fn<GateApi['postHeartbeat']>().mockResolvedValue({ status: 204, body: null }),
    postPassage: vi.fn<GateApi['postPassage']>(() => new Promise((resolve) => (answerPassage = resolve))),
  };
  return { api, answerPassage: (response: ApiResponse) => answerPassage(response) };
}

function editKey(state: ConsoleState, deviceKey: string) {
  state.deviceKey = deviceKey;
  state.identity = null;
  state.message = null;
}

describe('a key pasted while a press is in flight', () => {
  it('shows Sortie Démo and enables its exit loop when the Entrée Démo answer arrives late, keeping the counted passage', async () => {
    const state: ConsoleState = { deviceKey: ENTREE_KEY, identity: entreeDemo, passages: [], connection: ONLINE, message: null };
    const { api, answerPassage } = slowPassageApi();
    const heartbeat = createHeartbeat(state, api, vi.fn());

    const press = pressLoop({ loop: 'ENTRY', deviceKey: ENTREE_KEY, identity: entreeDemo, pressedAt: new Date(), armedAt: null }, api);
    editKey(state, SORTIE_KEY);
    await heartbeat.restart();
    answerPassage({ status: 200, body: countedEntry });
    Object.assign(state, applyPressOutcome(state, ENTREE_KEY, await press));

    expect(state.identity).toBe(sortieDemo);
    expect(isLoopAvailable('EXIT', state)).toBe(true);
    expect(isLoopAvailable('ENTRY', state)).toBe(false);
    expect(state.passages).toEqual([countedEntry]);
    expect(state.message).toBeNull();
  });

  it('keeps the Sortie Démo identity when the late answer is the identity the press itself asked for', async () => {
    const state: ConsoleState = { deviceKey: ENTREE_KEY, identity: null, passages: [], connection: ONLINE, message: null };
    const { api, answerPassage } = slowPassageApi();
    const heartbeat = createHeartbeat(state, api, vi.fn());

    const press = pressLoop({ loop: 'ENTRY', deviceKey: ENTREE_KEY, identity: null, pressedAt: new Date(), armedAt: null }, api);
    editKey(state, SORTIE_KEY);
    await heartbeat.restart();
    await vi.waitFor(() => expect(api.postPassage).toHaveBeenCalled());
    answerPassage({ status: 200, body: countedEntry });
    Object.assign(state, applyPressOutcome(state, ENTREE_KEY, await press));

    expect(state.identity).toBe(sortieDemo);
    expect(isLoopAvailable('EXIT', state)).toBe(true);
    expect(state.passages).toEqual([countedEntry]);
  });

  it('applies the answer when the key was changed and pasted back before it arrived', () => {
    const state = { deviceKey: ENTREE_KEY, passages: [] };

    const patch = applyPressOutcome(state, ENTREE_KEY, { kind: 'recorded', identity: entreeDemo, passage: countedEntry });

    expect(patch.identity).toBe(entreeDemo);
    expect(patch.message).toMatchObject({ recorded: { vehicleCount: 3 } });
  });

  it('keeps the refusal of the new key when the old key answer arrives late', () => {
    const state = { deviceKey: 'wrong-key', passages: [], message: { key: 'keyRefused', isError: true } as const };

    const patch = applyPressOutcome(state, ENTREE_KEY, { kind: 'recorded', identity: entreeDemo, passage: countedEntry });

    expect({ ...state, ...patch }.message).toEqual({ key: 'keyRefused', isError: true });
  });
});

import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { isLoopEnabled, messageForStatus, pressLoop } from '../../src/http/demo/loopPress.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const pressedAt = new Date('2026-10-27T22:02:00Z');
const entreeDemo: GateIdentity = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const recordedEntry = { gateId: 'gate-501', lotId: 'lot-201', kind: 'ENTRY', closedAt: pressedAt.toISOString(), vehicleCount: 1 };

function fakeApi(identity: ApiResponse, passage: ApiResponse = { status: 200, body: recordedEntry }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    postPassage: vi.fn<GateApi['postPassage']>().mockResolvedValue(passage),
  };
}

describe('messageForStatus', () => {
  it.each([
    [0, 'unreachable'],
    [401, 'keyRefused'],
    [403, 'gateForbidden'],
    [409, 'gateWithoutLoops'],
    [400, 'passageFailed'],
    [500, 'passageFailed'],
  ] as const)('maps %i to %s', (status, expected) => {
    expect(messageForStatus(status)).toBe(expected);
  });
});

describe('isLoopEnabled', () => {
  it('disables both loops until a key is typed', () => {
    expect(isLoopEnabled('ENTRY', { deviceKey: '', identity: null })).toBe(false);
  });

  it('enables both loops while the gate is not identified yet', () => {
    expect(isLoopEnabled('EXIT', { deviceKey: DEVICE_KEY, identity: null })).toBe(true);
  });

  it('enables only the loop matching the identified gate', () => {
    expect(isLoopEnabled('ENTRY', { deviceKey: DEVICE_KEY, identity: entreeDemo })).toBe(true);
    expect(isLoopEnabled('EXIT', { deviceKey: DEVICE_KEY, identity: entreeDemo })).toBe(false);
  });
});

describe('pressLoop', () => {
  it('identifies the gate, then records the passage', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: DEVICE_KEY, identity: null, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'recorded', identity: entreeDemo, passage: recordedEntry });
    expect(api.postPassage).toHaveBeenCalledWith(DEVICE_KEY, 'gate-501', '2026-10-27T22:02:00.000Z');
  });

  it('reuses a known identity without asking again', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    await pressLoop({ loop: 'ENTRY', deviceKey: DEVICE_KEY, identity: entreeDemo, pressedAt }, api);

    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('shows the refused key and posts nothing when the key is refused', async () => {
    const api = fakeApi({ status: 401, body: null });

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: DEVICE_KEY, identity: null, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.postPassage).not.toHaveBeenCalled();
  });

  it('does not post when the pressed loop does not match the gate', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    const outcome = await pressLoop({ loop: 'EXIT', deviceKey: DEVICE_KEY, identity: null, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'wrongLoop', identity: entreeDemo });
    expect(api.postPassage).not.toHaveBeenCalled();
  });

  it('refuses a key that cannot be a device key without calling the API', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo });

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: 'too-short', identity: null, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('warns that the count may have changed when the passage answer cannot be read', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo }, { status: 200, body: null });

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: DEVICE_KEY, identity: entreeDemo, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'refused', identity: entreeDemo, messageKey: 'passageUnconfirmed' });
  });

  it('shows the refused key when the key is revoked between identification and passage', async () => {
    const api = fakeApi({ status: 200, body: entreeDemo }, { status: 401, body: null });

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: DEVICE_KEY, identity: entreeDemo, pressedAt }, api);

    expect(outcome).toEqual({ kind: 'refused', identity: entreeDemo, messageKey: 'keyRefused' });
  });
});

import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { translate } from '../../src/http/demo/consoleText.js';
import { isPresenceEnabled, presenceMessageForStatus, sendPresence } from '../../src/http/demo/vehiclePresence.js';

const DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const sortieDemo: GateIdentity = { id: 'gate-502', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const entreeDemo: GateIdentity = { ...sortieDemo, id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY' };

function fakeApi(presence: ApiResponse, identity: ApiResponse = { status: 200, body: sortieDemo }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    postPresence: vi.fn<GateApi['postPresence']>().mockResolvedValue(presence),
  };
}

describe('sendPresence', () => {
  it('identifies the gate, then tells Palier a vehicle is at that gate', async () => {
    const api = fakeApi({ status: 200, body: { outcome: 'opened' } });

    const outcome = await sendPresence({ deviceKey: DEVICE_KEY, identity: null }, api);

    expect(outcome).toEqual({ kind: 'opened', identity: sortieDemo });
    expect(api.postPresence).toHaveBeenCalledWith(DEVICE_KEY, 'gate-502');
  });

  it.each(['waiting', 'fallback'] as const)('reports the %s outcome as the API answers it', async (outcome) => {
    const api = fakeApi({ status: 200, body: { outcome } });

    expect(await sendPresence({ deviceKey: DEVICE_KEY, identity: sortieDemo }, api)).toEqual({ kind: outcome, identity: sortieDemo });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('refuses a key that cannot be sent without calling the API', async () => {
    const api = fakeApi({ status: 200, body: null });

    expect(await sendPresence({ deviceKey: 'short', identity: null }, api)).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.postPresence).not.toHaveBeenCalled();
  });

  it('reports the refusal when the gate cannot be identified', async () => {
    const api = fakeApi({ status: 200, body: null }, { status: 401, body: null });

    expect(await sendPresence({ deviceKey: DEVICE_KEY, identity: null }, api)).toMatchObject({ kind: 'refused', messageKey: 'keyRefused' });
  });

  it('keeps the gate and reports the API refusal for an entry gate', async () => {
    const api = fakeApi({ status: 409, body: null });

    expect(await sendPresence({ deviceKey: DEVICE_KEY, identity: entreeDemo }, api)).toEqual({ kind: 'refused', identity: entreeDemo, messageKey: 'gateNotExit' });
  });
});

describe('presenceMessageForStatus', () => {
  it.each([
    [0, 'unreachable'],
    [401, 'keyRefused'],
    [403, 'gateForbidden'],
    [409, 'gateNotExit'],
    [503, 'presenceFailed'],
  ] as const)('maps %i to %s', (status, expected) => {
    expect(presenceMessageForStatus(status)).toBe(expected);
  });
});

describe('isPresenceEnabled', () => {
  it('is disabled until a key is typed, and for an entry gate', () => {
    expect(isPresenceEnabled({ deviceKey: '', identity: null })).toBe(false);
    expect(isPresenceEnabled({ deviceKey: DEVICE_KEY, identity: entreeDemo })).toBe(false);
  });

  it('is enabled for an exit gate, or while the gate is not identified', () => {
    expect(isPresenceEnabled({ deviceKey: DEVICE_KEY, identity: null })).toBe(true);
    expect(isPresenceEnabled({ deviceKey: DEVICE_KEY, identity: sortieDemo })).toBe(true);
  });
});

describe('presence texts', () => {
  it('names the button « Véhicule à la sortie » in French and English', () => {
    expect(translate('fr', 'presenceSend')).toBe('Véhicule à la sortie');
    expect(translate('en', 'presenceSend')).toBe('Vehicle at the exit');
  });
});

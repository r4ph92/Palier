import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { GateApi } from '../../src/http/demo/gateApi.js';
import { knownGateIdentity } from '../../src/http/demo/gateIdentity.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const sortieDemo: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };

function apiAnswering(status: number, body: unknown = null) {
  return { fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue({ status, body }) };
}

describe('knownGateIdentity', () => {
  it('refuses a key a header cannot carry without asking Palier', async () => {
    const api = apiAnswering(200, sortieDemo);

    const identity = await knownGateIdentity({ deviceKey: 'short', identity: null }, api);

    expect(identity).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('reuses the identity already known', async () => {
    const api = apiAnswering(200, sortieDemo);

    expect(await knownGateIdentity({ deviceKey: DEVICE_KEY, identity: sortieDemo }, api)).toBe(sortieDemo);
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('asks Palier for the gate when none is known', async () => {
    expect(await knownGateIdentity({ deviceKey: DEVICE_KEY, identity: null }, apiAnswering(200, sortieDemo))).toEqual(sortieDemo);
  });

  it.each([
    [0, 'unreachable'],
    [401, 'keyRefused'],
    [403, 'gateForbidden'],
  ] as const)('answers status %i with %s', async (status, messageKey) => {
    expect(await knownGateIdentity({ deviceKey: DEVICE_KEY, identity: null }, apiAnswering(status))).toEqual({ kind: 'refused', identity: null, messageKey });
  });
});

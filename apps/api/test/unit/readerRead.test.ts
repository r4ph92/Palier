import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { isReaderEnabled, readerMessageForStatus, sendReading } from '../../src/http/demo/readerRead.js';
import { translate } from '../../src/http/demo/consoleText.js';

const DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const sortieDemo: GateIdentity = { id: 'gate-502', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const entreeDemo: GateIdentity = { ...sortieDemo, id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY' };

function fakeApi(identify: ApiResponse, identity: ApiResponse = { status: 200, body: sortieDemo }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    postIdentify: vi.fn<GateApi['postIdentify']>().mockResolvedValue(identify),
  };
}

describe('sendReading', () => {
  it('identifies the gate, then sends the reading as typed to that gate', async () => {
    const api = fakeApi({ status: 200, body: { outcome: 'opened', identification: 'plate' } });

    const outcome = await sendReading({ deviceKey: DEVICE_KEY, identity: null, identifier: 'abc123' }, api);

    expect(outcome).toEqual({ kind: 'opened', identity: sortieDemo });
    expect(api.postIdentify).toHaveBeenCalledWith(DEVICE_KEY, 'gate-502', 'abc123');
  });

  it('reports the fallback when no single session was found', async () => {
    const api = fakeApi({ status: 200, body: { outcome: 'fallback', identification: null } });

    expect(await sendReading({ deviceKey: DEVICE_KEY, identity: sortieDemo, identifier: 'ZZZ 999' }, api)).toEqual({ kind: 'fallback', identity: sortieDemo });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });

  it('refuses a key that cannot be sent without calling the API', async () => {
    const api = fakeApi({ status: 200, body: null });

    const outcome = await sendReading({ deviceKey: 'short', identity: null, identifier: 'ABC123' }, api);

    expect(outcome).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.postIdentify).not.toHaveBeenCalled();
  });

  it('reports the refusal when the gate cannot be identified', async () => {
    const api = fakeApi({ status: 200, body: null }, { status: 401, body: null });

    expect(await sendReading({ deviceKey: DEVICE_KEY, identity: null, identifier: 'ABC123' }, api)).toMatchObject({ kind: 'refused', messageKey: 'keyRefused' });
  });

  it('keeps the gate and reports the API refusal', async () => {
    const api = fakeApi({ status: 409, body: null });

    expect(await sendReading({ deviceKey: DEVICE_KEY, identity: entreeDemo, identifier: 'ABC123' }, api)).toEqual({ kind: 'refused', identity: entreeDemo, messageKey: 'gateWithoutReader' });
  });
});

describe('readerMessageForStatus', () => {
  it.each([
    [0, 'unreachable'],
    [400, 'identifierInvalid'],
    [401, 'keyRefused'],
    [403, 'gateForbidden'],
    [409, 'gateWithoutReader'],
    [503, 'readerFailed'],
  ] as const)('maps %i to %s', (status, expected) => {
    expect(readerMessageForStatus(status)).toBe(expected);
  });
});

describe('isReaderEnabled', () => {
  it('is disabled until a key is typed, and for an entry gate', () => {
    expect(isReaderEnabled({ deviceKey: '', identity: null })).toBe(false);
    expect(isReaderEnabled({ deviceKey: DEVICE_KEY, identity: entreeDemo })).toBe(false);
  });

  it('is enabled for an exit gate, or while the gate is not identified', () => {
    expect(isReaderEnabled({ deviceKey: DEVICE_KEY, identity: null })).toBe(true);
    expect(isReaderEnabled({ deviceKey: DEVICE_KEY, identity: sortieDemo })).toBe(true);
  });
});

describe('reader texts', () => {
  it('reads the fallback and the plate label as the story says', () => {
    expect(translate('fr', 'readerFallback')).toBe("Aucune session — repli sur l'app");
    expect(translate('fr', 'plateLabel')).toBe('Plaque lue');
  });
});

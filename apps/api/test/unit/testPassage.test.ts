import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';
import { createGateApi } from '../../src/http/demo/gateApi.js';
import { messageText, translate } from '../../src/http/demo/consoleText.js';
import { isTestPassageEnabled, sendTestPassage, testPassageMessage, testPassageMessageForStatus } from '../../src/http/demo/testPassage.js';

const DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
const entreeDemo: GateIdentity = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const VERIFIED_AT = new Date(2026, 10, 15, 18, 2);

function fakeApi(testPassage: ApiResponse, identity: ApiResponse = { status: 200, body: entreeDemo }) {
  return {
    fetchIdentity: vi.fn<GateApi['fetchIdentity']>().mockResolvedValue(identity),
    postTestPassage: vi.fn<GateApi['postTestPassage']>().mockResolvedValue(testPassage),
  };
}

describe('sendTestPassage', () => {
  it('identifies the gate, then posts its test passage and reads back the verified time', async () => {
    const api = fakeApi({ status: 200, body: { verifiedAt: VERIFIED_AT.toISOString() } });

    const outcome = await sendTestPassage({ deviceKey: DEVICE_KEY, identity: null }, api);

    expect(outcome).toEqual({ kind: 'verified', identity: entreeDemo, verifiedAt: VERIFIED_AT });
    expect(api.postTestPassage).toHaveBeenCalledWith(DEVICE_KEY, 'gate-501');
  });

  it('refuses a key that cannot be sent without calling the API', async () => {
    const api = fakeApi({ status: 200, body: null });

    expect(await sendTestPassage({ deviceKey: 'short', identity: null }, api)).toEqual({ kind: 'refused', identity: null, messageKey: 'keyRefused' });
    expect(api.postTestPassage).not.toHaveBeenCalled();
  });

  it('keeps the gate and reports that Palier has not heard it', async () => {
    const api = fakeApi({ status: 409, body: null });

    expect(await sendTestPassage({ deviceKey: DEVICE_KEY, identity: entreeDemo }, api)).toEqual({ kind: 'refused', identity: entreeDemo, messageKey: 'gateNotHeard' });
    expect(api.fetchIdentity).not.toHaveBeenCalled();
  });
});

describe('testPassageMessageForStatus', () => {
  it.each([
    [0, 'unreachable'],
    [401, 'keyRefused'],
    [403, 'gateForbidden'],
    [409, 'gateNotHeard'],
    [503, 'testPassageFailed'],
  ] as const)('maps %i to %s', (status, expected) => {
    expect(testPassageMessageForStatus(status)).toBe(expected);
  });
});

describe('isTestPassageEnabled', () => {
  it('waits for a key, and stays off while the console is offline', () => {
    expect(isTestPassageEnabled({ deviceKey: '', isOffline: false })).toBe(false);
    expect(isTestPassageEnabled({ deviceKey: DEVICE_KEY, isOffline: true })).toBe(false);
    expect(isTestPassageEnabled({ deviceKey: DEVICE_KEY, isOffline: false })).toBe(true);
  });
});

describe('test passage texts', () => {
  const verified = testPassageMessage({ kind: 'verified', identity: entreeDemo, verifiedAt: VERIFIED_AT });

  it('tells the verified time in French and English', () => {
    expect(messageText('fr', verified)).toBe('Barrière vérifiée à 18\u00a0h\u00a002\u00a0: elle compte pour la mise en ligne du parking.');
    expect(messageText('en', verified)).toBe('Gate verified at 6:02\u00a0PM: it counts toward putting the lot online.');
  });

  it('names the button « Passage de test » and "Test passage"', () => {
    expect([translate('fr', 'testPassageSend'), translate('en', 'testPassageSend')]).toEqual(['Passage de test', 'Test passage']);
  });

  it('shows a refusal as an error', () => {
    expect(testPassageMessage({ kind: 'refused', identity: entreeDemo, messageKey: 'gateNotHeard' })).toEqual({ key: 'gateNotHeard', isError: true });
  });
});

describe('the gate API', () => {
  it('posts the test passage to the gate’s own route with its device key', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ verifiedAt: VERIFIED_AT.toISOString() })));

    await createGateApi(fetchFunction).postTestPassage(DEVICE_KEY, 'gate-501');

    expect(fetchFunction).toHaveBeenCalledWith('/v1/gates/gate-501/test-passage', expect.objectContaining({ method: 'POST', headers: { authorization: `Bearer ${DEVICE_KEY}` } }));
  });
});

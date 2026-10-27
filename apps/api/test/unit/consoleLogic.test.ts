import type { GateIdentity } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createGateApi,
  formatPassageTime,
  isLoopEnabled,
  messageForStatus,
  pressLoop,
  translate,
  translations,
  vehiclesInside,
  type ApiResponse,
  type GateApi,
} from '../../src/http/demo/consoleLogic.js';

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

describe('console translations', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.fr).sort());
  });

  it.each([
    ['fr', 'loopENTRY', 'Boucle d’entrée fermée'],
    ['fr', 'loopEXIT', 'Boucle de sortie fermée'],
    ['fr', 'keyRefused', 'Clé d’appareil refusée'],
    ['en', 'loopENTRY', 'Entry loop closed'],
    ['en', 'loopEXIT', 'Exit loop closed'],
    ['en', 'keyRefused', 'Device key refused'],
  ] as const)('%s %s reads "%s"', (language, key, expected) => {
    expect(translate(language, key)).toBe(expected);
  });

  it('fills the placeholders', () => {
    expect(translate('fr', 'gateIdentity', { name: 'Entrée Démo', kind: 'Entrée', lot: 'Parking Démo' })).toBe(
      'Entrée Démo · Entrée · Parking Démo',
    );
  });

  it.each([
    ['fr', 0, '0 véhicule dans le parking'],
    ['fr', 1, '1 véhicule dans le parking'],
    ['fr', 9, '9 véhicules dans le parking'],
    ['en', 0, '0 vehicles in the lot'],
    ['en', 1, '1 vehicle in the lot'],
  ] as const)('%s with %i vehicles reads "%s"', (language, count, expected) => {
    expect(vehiclesInside(count, language)).toBe(expected);
  });
});

describe('formatPassageTime', () => {
  it.each([
    ['fr', new Date(2026, 9, 27, 18, 2), '18 h 02'],
    ['en', new Date(2026, 9, 27, 18, 2), '6:02 PM'],
    ['en', new Date(2026, 9, 27, 0, 5), '12:05 AM'],
    ['en', new Date(2026, 9, 27, 12, 0), '12:00 PM'],
  ] as const)('%s writes %s as %s', (language, moment, expected) => {
    expect(formatPassageTime(moment, language)).toBe(expected);
  });
});

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

describe('createGateApi', () => {
  it('sends the key as a Bearer header and the loop time as JSON', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(Response.json(recordedEntry));

    const response = await createGateApi(fetchFunction).postPassage(DEVICE_KEY, 'gate-501', pressedAt.toISOString());

    expect(response).toEqual({ status: 200, body: recordedEntry });
    expect(fetchFunction).toHaveBeenCalledWith('/v1/gates/gate-501/passage', {
      method: 'POST',
      headers: { authorization: `Bearer ${DEVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ closedAt: pressedAt.toISOString() }),
      cache: 'no-store',
      credentials: 'omit',
    });
  });

  it('reports the status of a refusal', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 401, body: null });
  });

  it('reports no body when a success answer is not JSON', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>proxy</html>', { status: 200 }));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 200, body: null });
  });

  it('reports status 0 when the API cannot be reached', async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await createGateApi(fetchFunction).fetchIdentity(DEVICE_KEY)).toEqual({ status: 0, body: null });
  });
});

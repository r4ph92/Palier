import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { julieInside } from './fakes/fakeExits.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeGateDeviceKeyRepository, REVOKED_KEY, SORTIE_DEMO_KEY, sortieDemo, UNKNOWN_KEY } from './fakes/gateFixtures.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const at2117 = new Date(2026, 10, 4, 21, 17);
const FALLBACK = { outcome: 'fallback', identification: null };
const RFID_KEY = 'rfidSortieKey000000000000000000000000000000';
const NO_READER_KEY = 'noReaderSortieKey00000000000000000000000000';

describe('POST /v1/gates/:id/identify', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function julieParked() {
    const deviceKeys = new FakeGateDeviceKeyRepository()
      .withGate(RFID_KEY, { ...sortieDemo, exitIdKind: 'RFID' })
      .withGate(NO_READER_KEY, { ...sortieDemo, exitIdKind: 'NONE' });
    const configured = configureServer({ deviceKeys, testSignInEnabled: true });
    server = configured.server;
    configured.exits.add('driver-julie', { ...julieInside(enteredAt), lotId: sortieDemo.lotId }, { plateKey: 'ABC123', transponderKey: 'T0042' });
    configured.testClock.setFixed(at2117);
    const identify = (identifier: unknown, deviceKey = SORTIE_DEMO_KEY, gateId = sortieDemo.id) =>
      server.inject({ method: 'POST', url: `/v1/gates/${gateId}/identify`, headers: { authorization: `Bearer ${deviceKey}` }, payload: { identifier } });
    return { ...configured, identify };
  }

  it('captures, closes the session and answers "plate" when the console sends "abc123"', async () => {
    const { identify, entries, exits } = julieParked();

    const response = await identify('abc123');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: 'opened', identification: 'plate' });
    expect(entries.payments.captured).toMatchObject([{ paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(exits.closings).toMatchObject([{ exitGateId: sortieDemo.id, identification: 'PLATE' }]);
  });

  it('answers "transponder" when the console sends "T-0042" to a transponder gate', async () => {
    const { identify, exits } = julieParked();

    const response = await identify('T-0042', RFID_KEY);

    expect(response.json()).toEqual({ outcome: 'opened', identification: 'transponder' });
    expect(exits.closings).toMatchObject([{ identification: 'TRANSPONDER' }]);
  });

  it('answers the fallback and takes nothing for a plate with no open session', async () => {
    const { identify, entries, exits } = julieParked();

    const response = await identify('ZZZ 999');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(FALLBACK);
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('answers the fallback and takes nothing when the plate is on two open sessions', async () => {
    const { identify, entries, exits } = julieParked();
    exits.add('driver-marc', { ...julieInside(enteredAt), id: 'session-marc', lotId: sortieDemo.lotId }, { plateKey: 'ABC123' });

    const response = await identify('ABC123');

    expect(response.json()).toEqual(FALLBACK);
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('refuses a gate with no reader with 409 and changes nothing', async () => {
    const { identify, entries, exits } = julieParked();

    const response = await identify('ABC123', NO_READER_KEY);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'GATE_WITHOUT_READER' });
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('refuses the key of an entry gate with 409', async () => {
    const { identify, entries } = julieParked();

    const response = await identify('ABC123', ENTREE_DEMO_KEY, entreeDemo.id);

    expect(response.statusCode).toBe(409);
    expect(entries.payments.captured).toEqual([]);
  });

  it('refuses a missing, unknown or revoked device key with 401 and changes nothing', async () => {
    const { identify, entries, exits } = julieParked();

    const unknown = await identify('ABC123', UNKNOWN_KEY);
    const revoked = await identify('ABC123', REVOKED_KEY);
    const missing = await server.inject({ method: 'POST', url: `/v1/gates/${sortieDemo.id}/identify`, payload: { identifier: 'ABC123' } });
    const malformed = await identify('ABC123', 'short');

    for (const response of [unknown, revoked, missing, malformed]) {
      expect(response.statusCode).toBe(401);
    }
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('refuses a device key used on another gate with 403', async () => {
    const { identify, entries } = julieParked();

    const response = await identify('ABC123', SORTIE_DEMO_KEY, entreeDemo.id);

    expect(response.statusCode).toBe(403);
    expect(entries.payments.captured).toEqual([]);
  });

  it('refuses a forged identifier or a body that is not one, with 400, and changes nothing', async () => {
    const { identify, entries, exits } = julieParked();

    for (const identifier of ['', "ABC';--", 'ABC_123', 'A'.repeat(65), 'ABCDEFGHI', 42, null]) {
      const response = await identify(identifier);

      expect([identifier, response.statusCode]).toEqual([identifier, 400]);
    }
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('does not accept a driver token in place of the device key', async () => {
    const { server: running, entries } = julieParked();

    const response = await running.inject({ method: 'POST', url: `/v1/gates/${sortieDemo.id}/identify`, headers: { authorization: 'Bearer driver-token' }, payload: { identifier: 'ABC123' } });

    expect(response.statusCode).toBe(401);
    expect(entries.payments.captured).toEqual([]);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink, signGateToken } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, marc } from './fakeDriverRepository.ts';
import {
  ENTREE_DEMO_SECRET,
  ENTREE_ROY_SECRET,
  entreeDemoGate,
  entreeRoyGate,
  SORTIE_DEMO_SECRET,
  sortieDemoGate,
  fakeSessionId,
} from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

describe('POST /v1/entries', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const enter = (qrContent: unknown) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
    return { ...configured, headers, enter };
  }

  it('gives Julie spot A-1 at Entrée Démo, holds the cap and opens the barrier', async () => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ sessionId: fakeSessionId(1), spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' }, barrierOpened: true });
    expect(entries.payments.authorized).toHaveLength(1);
    expect(entries.gateCommander.opened).toHaveLength(1);
  });

  it('accepts the bare token as well as the printed link', async () => {
    const { enter } = await startWithJulieReady();

    expect((await enter(signGateToken(entreeDemoGate.id, ENTREE_DEMO_SECRET))).statusCode).toBe(201);
  });

  it.each([
    ['a token altered by one character', `${entreeDemoQr.slice(0, -1)}${entreeDemoQr.endsWith('A') ? 'B' : 'A'}`, { statusCode: 400, error: 'QR_NOT_RECOGNIZED' }],
    ['the QR of Sortie Démo', gateQrLink(sortieDemoGate.id, SORTIE_DEMO_SECRET), { statusCode: 409, error: 'NOT_AN_ENTRY_GATE' }],
    ['the QR of Entrée Roy', gateQrLink(entreeRoyGate.id, ENTREE_ROY_SECRET), { statusCode: 409, error: 'LOT_NOT_IN_SERVICE' }],
    ['an empty content', '', { statusCode: 400, error: 'QR_NOT_RECOGNIZED' }],
  ])('refuses %s and writes nothing', async (_case, qrContent, refusal) => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter(qrContent);

    expect(response.statusCode).toBe(refusal.statusCode);
    expect(response.json()).toMatchObject(refusal);
    expect(entries.journal).toEqual([]);
  });

  it('refuses Marc without plate or card with PREREQUISITES_MISSING and creates nothing', async () => {
    const { server: configured, driverRepository, entries } = configureServer();
    server = configured;
    await acceptNoticeAs(driverRepository, marc);
    const headers = await authorizationFor(driverRepository, marc);

    const response = await server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'PREREQUISITES_MISSING' });
    expect(entries.journal).toEqual([]);
  });

  it('answers 402 CARD_DECLINED with the refused amount, frees the spot and opens nothing when the card is refused', async () => {
    const { enter, entries } = await startWithJulieReady();
    entries.payments.refusal = 'CARD_DECLINED';

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(402);
    expect(response.json()).toEqual({ statusCode: 402, error: 'CARD_DECLINED', message: 'The card was declined.', authorizedCents: 2500 });
    expect(entries.sessions.freeSpots).toHaveLength(10);
    expect(entries.journal).not.toContain('open-gate');
  });

  it('answers 409 NO_SUITABLE_SPOT, holds nothing and opens nothing when no free spot fits the vehicle', async () => {
    const { enter, entries } = await startWithJulieReady();
    entries.sessions.noSuitableSpot = true;

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'NO_SUITABLE_SPOT', message: 'No free spot fits this vehicle.' });
    expect(entries.journal).not.toContain('authorize');
    expect(entries.journal).not.toContain('open-gate');
  });

  it('answers 503 PAYMENTS_UNAVAILABLE when Stripe cannot be reached', async () => {
    const { enter, entries } = await startWithJulieReady();
    entries.payments.refusal = 'PAYMENTS_UNAVAILABLE';

    expect((await enter(entreeDemoQr)).json()).toEqual({
      statusCode: 503,
      error: 'PAYMENTS_UNAVAILABLE',
      message: 'Card payments are unavailable right now.',
    });
  });

  it('answers a second scan of the same gate with the same entry and spot, holding the card once', async () => {
    const { enter, entries } = await startWithJulieReady();
    const first = await enter(entreeDemoQr);

    const second = await enter(entreeDemoQr);

    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(entries.payments.authorized).toHaveLength(1);
  });

  it('answers 409 ALREADY_INSIDE to a scan once the first entry is confirmed', async () => {
    const { enter, entries } = await startWithJulieReady();
    await enter(entreeDemoQr);
    entries.sessions.confirmEntry(fakeSessionId(1), new Date('2026-11-04T12:00:00Z'));

    const second = await enter(entreeDemoQr);

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: 'ALREADY_INSIDE' });
  });

  it('answers 500 with a generic body when the barrier command breaks', async () => {
    const { enter, entries } = await startWithJulieReady();
    entries.gateCommander.fails = true;

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ statusCode: 500, error: 'Internal Server Error' });
  });

  it.each([
    ['a QR content over 512 characters', { qrContent: 'x'.repeat(513) }],
    ['no QR content', {}],
    ['a QR content that is not text', { qrContent: 42 }],
  ])('refuses %s as an unrecognized QR', async (_case, payload) => {
    const { headers } = await startWithJulieReady();

    const response = await server.inject({ method: 'POST', url: '/v1/entries', headers, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ statusCode: 400, error: 'QR_NOT_RECOGNIZED', message: 'This QR is not a Palier terminal.' });
  });
});

describe('GET /v1/entries/:sessionId', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieEntered() {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr } });
    const status = (sessionId: string, as = headers) => server.inject({ method: 'GET', url: `/v1/entries/${sessionId}`, headers: as });
    return { ...configured, headers, status };
  }

  it('shows the barrier open and no confirmation until the loop closes', async () => {
    const { status } = await startWithJulieEntered();

    const response = await status(fakeSessionId(1));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: fakeSessionId(1),
      state: 'CREATED',
      spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
      entryConfirmedAt: null,
    });
  });

  it('shows ENTRY_CONFIRMED with the passage time once the loop closed', async () => {
    const { status, entries } = await startWithJulieEntered();
    entries.sessions.confirmEntry(fakeSessionId(1), new Date('2026-10-27T22:02:00Z'));

    const response = await status(fakeSessionId(1));

    expect(response.json()).toMatchObject({ state: 'ENTRY_CONFIRMED', entryConfirmedAt: '2026-10-27T22:02:00.000Z' });
  });

  it("answers 404 SESSION_NOT_FOUND to Marc asking for Julie's session", async () => {
    const { status, driverRepository, vehicleRepository } = await startWithJulieEntered();
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    const response = await status(fakeSessionId(1), marcHeaders);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'SESSION_NOT_FOUND' });
  });

  it('answers 404 for a session that does not exist and 400 for an id that is not a UUID', async () => {
    const { status } = await startWithJulieEntered();

    expect((await status(fakeSessionId(99))).statusCode).toBe(404);
    expect((await status('not-a-uuid')).statusCode).toBe(400);
  });

  it('refuses a request without a driver token', async () => {
    const { status } = await startWithJulieEntered();

    expect((await status(fakeSessionId(1), {} as never)).statusCode).toBe(401);
  });

  it("answers Marc the same 404 body for Julie's session as for an unknown one, so session ids cannot be probed", async () => {
    const { status, driverRepository, vehicleRepository } = await startWithJulieEntered();
    const marcHeaders = await readyDriver(driverRepository, vehicleRepository, marc);

    const julies = await status(fakeSessionId(1), marcHeaders);
    const unknown = await status(fakeSessionId(99), marcHeaders);

    expect(julies.json()).toEqual({ statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such entry.' });
    expect(unknown.json()).toEqual(julies.json());
  });
});

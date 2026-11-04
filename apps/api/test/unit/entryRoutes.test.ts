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
    expect(response.json()).toEqual({ sessionId: 'session-1', spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' }, barrierOpened: true });
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

  it('answers 402 CARD_DECLINED and frees the spot when the card is refused', async () => {
    const { enter, entries } = await startWithJulieReady();
    entries.payments.refusal = 'CARD_DECLINED';

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(402);
    expect(response.json()).toMatchObject({ error: 'CARD_DECLINED' });
    expect(entries.sessions.freeSpots).toHaveLength(10);
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

  it('answers 409 ALREADY_INSIDE to a second scan while the first entry is active', async () => {
    const { enter } = await startWithJulieReady();
    await enter(entreeDemoQr);

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

  it('refuses a sixth entry that would reach Stripe within ten minutes', async () => {
    const { enter } = await startWithJulieReady();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await enter(entreeDemoQr);
    }

    const sixth = await enter(entreeDemoQr);

    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toEqual({ statusCode: 429, error: 'TOO_MANY_ENTRIES', message: 'Too many entry attempts. Try again in a few minutes.' });
  });

  it('does not count refused QRs against the limit', async () => {
    const { enter } = await startWithJulieReady();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await enter('not a QR');
    }

    expect((await enter(entreeDemoQr)).statusCode).toBe(201);
  });

  it.each([
    ['a QR content over 512 characters', { qrContent: 'x'.repeat(513) }],
    ['no QR content', {}],
    ['a QR content that is not text', { qrContent: 42 }],
  ])('refuses %s with 400', async (_case, payload) => {
    const { headers } = await startWithJulieReady();

    const response = await server.inject({ method: 'POST', url: '/v1/entries', headers, payload });

    expect(response.statusCode).toBe(400);
  });
});

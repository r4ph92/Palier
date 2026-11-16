import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, marc } from './fakeDriverRepository.ts';
import { ENTREE_DEMO_SECRET, ENTREE_ROY_SECRET, entreeDemoGate, entreeRoyGate, SORTIE_DEMO_SECRET, sortieDemoGate, ACCEPTED_DEMO_TARIFF } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

// #151: the tariff and the hold Julie sees after the scan, before she taps « Entrer ».
describe('POST /v1/entries/quote', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const quote = (qrContent: unknown) => server.inject({ method: 'POST', url: '/v1/entries/quote', headers, payload: { qrContent } });
    const enter = () => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr, tariff: ACCEPTED_DEMO_TARIFF } });
    return { ...configured, quote, enter };
  }

  it('answers Parking Démo at 0,75 $ per 15 min, cap 25,00 $, and the 25,00 $ the card will hold', async () => {
    const { quote } = await startWithJulieReady();

    const response = await quote(entreeDemoQr);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ lotName: 'Parking Démo', tariff: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 }, holdCents: 2500 });
  });

  it('assigns no spot, holds nothing and commands no opening', async () => {
    const { quote, entries } = await startWithJulieReady();

    await quote(entreeDemoQr);

    expect(entries.journal).toEqual([]);
    expect(entries.sessions.drafts).toEqual([]);
    expect(entries.payments.authorized).toEqual([]);
    expect(entries.gateCommander.opened).toEqual([]);
  });

  it.each([
    ['the QR of Sortie Démo', gateQrLink(sortieDemoGate.id, SORTIE_DEMO_SECRET), { statusCode: 409, error: 'NOT_AN_ENTRY_GATE' }],
    ['the QR of Entrée Roy, whose lot is offline', gateQrLink(entreeRoyGate.id, ENTREE_ROY_SECRET), { statusCode: 409, error: 'LOT_NOT_IN_SERVICE' }],
    ['a token altered by one character', `${entreeDemoQr.slice(0, -1)}${entreeDemoQr.endsWith('A') ? 'B' : 'A'}`, { statusCode: 400, error: 'QR_NOT_RECOGNIZED' }],
    ['a QR content that is not text', 42, { statusCode: 400, error: 'QR_NOT_RECOGNIZED' }],
  ])('refuses %s with the entry refusal and writes nothing', async (_case, qrContent, refusal) => {
    const { quote, entries } = await startWithJulieReady();

    const response = await quote(qrContent);

    expect(response.json()).toMatchObject(refusal);
    expect(entries.journal).toEqual([]);
  });

  it('refuses Marc without plate or card before showing a tariff', async () => {
    const { server: configured, driverRepository } = configureServer();
    server = configured;
    await acceptNoticeAs(driverRepository, marc);
    const headers = await authorizationFor(driverRepository, marc);

    const response = await server.inject({ method: 'POST', url: '/v1/entries/quote', headers, payload: { qrContent: entreeDemoQr } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'PREREQUISITES_MISSING' });
  });

  it('refuses a signed-out caller', async () => {
    server = configureServer().server;

    const response = await server.inject({ method: 'POST', url: '/v1/entries/quote', payload: { qrContent: entreeDemoQr } });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a sixth quote within ten minutes', async () => {
    const { quote } = await startWithJulieReady();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await quote(entreeDemoQr);
    }

    const sixth = await quote(entreeDemoQr);

    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toMatchObject({ error: 'TOO_MANY_ENTRIES' });
  });

  it('counts quotes apart from entries, so looking at the tariff never blocks the entry', async () => {
    const { quote, enter } = await startWithJulieReady();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await quote(entreeDemoQr);
    }

    expect((await enter()).statusCode).toBe(201);
  });
});

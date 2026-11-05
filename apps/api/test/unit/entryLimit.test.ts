import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, fakeSessionId } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

describe('the entry limit of POST /v1/entries', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const enter = (qrContent: unknown) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
    return { ...configured, enter };
  }

  it('refuses a sixth entry that would reach Stripe within ten minutes', async () => {
    const { enter, entries } = await startWithJulieReady();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await enter(entreeDemoQr);
      entries.sessions.cancelIfCreated(fakeSessionId(attempt));
    }

    const sixth = await enter(entreeDemoQr);

    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toEqual({ statusCode: 429, error: 'TOO_MANY_ENTRIES', message: 'Too many entry attempts. Try again in a few minutes.' });
  });

  it('does not count replayed scans of the same entry against the limit', async () => {
    const { enter, entries } = await startWithJulieReady();
    await enter(entreeDemoQr);
    for (let replay = 0; replay < 5; replay += 1) {
      await enter(entreeDemoQr);
    }

    const sixthReplay = await enter(entreeDemoQr);

    expect(sixthReplay.statusCode).toBe(201);
    expect(entries.payments.authorized).toHaveLength(1);
  });

  it('does not count refused QRs against the limit', async () => {
    const { enter } = await startWithJulieReady();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await enter('not a QR');
    }

    expect((await enter(entreeDemoQr)).statusCode).toBe(201);
  });
});

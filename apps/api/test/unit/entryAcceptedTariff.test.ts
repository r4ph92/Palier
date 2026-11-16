import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { TariffPolicy } from '@palier/shared-types';
import type { EntryGate, EntryGateRepository } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { ACCEPTED_DEMO_TARIFF, ENTREE_DEMO_SECRET, entreeDemoGate } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);
// What Sophie saves while Julie is on the tariff screen: 1,00 $ par 15 min, plafond 30,00 $.
const SOPHIE_NEW_TARIFF: TariffPolicy = { incrementCents: 100, incrementMinutes: 15, dailyCapCents: 3000 };

// Entrée Démo, whose lot Sophie can reprice between two requests, as the dashboard writes parking_lot.
class RepricedGates implements EntryGateRepository {
  tariff: TariffPolicy = ACCEPTED_DEMO_TARIFF;

  findGate(gateId: string): Promise<EntryGate | null> {
    const { incrementCents, incrementMinutes, dailyCapCents } = this.tariff;
    const lot = { ...entreeDemoGate.lot, pricingPolicy: { incrementCents, incrementMinutes }, dailyCapCents };
    return Promise.resolve(gateId === entreeDemoGate.id ? { ...entreeDemoGate, lot } : null);
  }
}

// #151: the entry names the tariff Julie accepted on the tariff screen; any other is refused before a spot, a hold or an opening.
describe('POST /v1/entries with the accepted tariff', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const gates = new RepricedGates();
    const configured = configureServer({ entryGates: gates });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const enter = (payload: object) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr, ...payload } });
    return { ...configured, gates, enter };
  }

  it('holds 25,00 $ and copies 0,75 $ par 15 min on the session when Julie enters at the tariff she saw', async () => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter({ tariff: ACCEPTED_DEMO_TARIFF });

    expect(response.statusCode).toBe(201);
    expect(entries.payments.authorized.map(({ amountCents }) => amountCents)).toEqual([2500]);
    expect(entries.sessions.drafts.map(({ pricing }) => pricing)).toEqual([ACCEPTED_DEMO_TARIFF]);
  });

  it('refuses the tariff Julie saw once Sophie saved a new one, answers the new tariff and keeps everything shut', async () => {
    const { enter, entries, gates } = await startWithJulieReady();
    gates.tariff = SOPHIE_NEW_TARIFF;

    const response = await enter({ tariff: ACCEPTED_DEMO_TARIFF });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'TARIFF_CHANGED', message: "This lot's tariff just changed.", tariff: SOPHIE_NEW_TARIFF });
    expect(entries.journal).toEqual([]);
    expect(entries.sessions.drafts).toEqual([]);
    expect(entries.gateCommander.opened).toEqual([]);
  });

  it('holds 30,00 $ and bills 1,00 $ par 15 min once Julie accepts the new tariff', async () => {
    const { enter, entries, gates } = await startWithJulieReady();
    gates.tariff = SOPHIE_NEW_TARIFF;
    await enter({ tariff: ACCEPTED_DEMO_TARIFF });

    const response = await enter({ tariff: SOPHIE_NEW_TARIFF });

    expect(response.statusCode).toBe(201);
    expect(entries.payments.authorized.map(({ amountCents }) => amountCents)).toEqual([3000]);
    expect(entries.sessions.drafts.map(({ pricing }) => pricing)).toEqual([SOPHIE_NEW_TARIFF]);
  });

  it.each([
    ['no tariff', {}],
    ['an older tariff', { tariff: { incrementCents: 50, incrementMinutes: 15, dailyCapCents: 2500 } }],
    ['a lower cap', { tariff: { ...ACCEPTED_DEMO_TARIFF, dailyCapCents: 2400 } }],
    ['a longer increment', { tariff: { ...ACCEPTED_DEMO_TARIFF, incrementMinutes: 20 } }],
  ])('refuses an entry naming %s with the current tariff and holds nothing', async (_case, payload) => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter(payload);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'TARIFF_CHANGED', tariff: ACCEPTED_DEMO_TARIFF });
    expect(entries.journal).toEqual([]);
  });

  it.each([
    ['a tariff given as text', { tariff: '0,75 $ / 15 min' }],
    ['a tariff missing its cap', { tariff: { incrementCents: 75, incrementMinutes: 15 } }],
    ['a fractional cap', { tariff: { ...ACCEPTED_DEMO_TARIFF, dailyCapCents: 2500.5 } }],
  ])('refuses %s at the schema and holds nothing', async (_case, payload) => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter(payload);

    expect(response.statusCode).toBe(400);
    expect(entries.journal).toEqual([]);
  });

  it('drops an extra field from the tariff, as ajv drops unknown keys, and enters at the tariff named', async () => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter({ tariff: { ...ACCEPTED_DEMO_TARIFF, dailyCapCents: 2500, holdQuota: 3 } });

    expect(response.statusCode).toBe(201);
    expect(entries.payments.authorized.map(({ amountCents }) => amountCents)).toEqual([2500]);
  });

  it('does not count a changed tariff against the entry limit', async () => {
    const { enter, gates } = await startWithJulieReady();
    gates.tariff = SOPHIE_NEW_TARIFF;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await enter({ tariff: ACCEPTED_DEMO_TARIFF });
    }

    expect((await enter({ tariff: SOPHIE_NEW_TARIFF })).statusCode).toBe(201);
  });
});

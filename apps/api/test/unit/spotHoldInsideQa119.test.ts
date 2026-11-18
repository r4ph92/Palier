import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { SPOT_HOLD_ATTEMPT_LIMIT } from '../../src/domain/spotHolds/spotHoldAttemptLimit.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { marc } from './fakeDriverRepository.ts';
import { ACCEPTED_DEMO_TARIFF, ENTREE_DEMO_SECRET, ENTREE_ROY_SECRET, entreeDemoGate, entreeRoyGate, FakeEntryGateRepository, LAVOIE_ACCOUNT } from './fakes/entryGateFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const ALREADY_INSIDE_BODY = { statusCode: 409, error: 'ALREADY_INSIDE', message: 'You are already in a parking lot.' };
const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);
const entreeRoyQr = gateQrLink(entreeRoyGate.id, ENTREE_ROY_SECRET);
const onlineEntreeRoyGate = { ...entreeRoyGate, integrationKind: 'SIMULATED' as const, lot: { ...entreeRoyGate.lot, isOnline: true, operatorStripeAccountId: LAVOIE_ACCOUNT } };

describe('POST /v1/lots/:id/holds around real entries (QA #119)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieAndMarcReady() {
    const configured = configureServer({ testSignInEnabled: true, entryGates: new FakeEntryGateRepository([entreeDemoGate, onlineEntreeRoyGate]) });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const julieHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    const marcHeaders = await readyDriver(configured.driverRepository, configured.vehicleRepository, marc);
    const enter = (headers: typeof julieHeaders, qrContent: string) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent, tariff: ACCEPTED_DEMO_TARIFF } });
    const hold = (lotId: string = PARKING_DEMO_ID, headers = julieHeaders) => server.inject({ method: 'POST', url: `/v1/lots/${lotId}/holds`, headers });
    return { ...configured, julieHeaders, marcHeaders, enter, hold };
  }

  it('keeps answering ALREADY_INSIDE past the attempt limit, since a refusal before the lot lock spends no attempt', async () => {
    const { hold, enter, julieHeaders, spotHolds } = await startWithJulieAndMarcReady();
    await enter(julieHeaders, entreeDemoQr);

    const responses = [];
    for (let attempt = 0; attempt <= SPOT_HOLD_ATTEMPT_LIMIT; attempt += 1) responses.push(await hold());

    expect(responses.map((response) => response.statusCode)).toEqual(Array(SPOT_HOLD_ATTEMPT_LIMIT + 1).fill(409));
    expect(responses.at(-1)?.json()).toEqual(ALREADY_INSIDE_BODY);
    expect(spotHolds.drafts).toHaveLength(0);
  });

  it('refuses Julie inside Parking Démo a hold at a lot elsewhere as ALREADY_INSIDE too', async () => {
    const { hold, enter, julieHeaders, spotHolds } = await startWithJulieAndMarcReady();
    await enter(julieHeaders, entreeDemoQr);

    const response = await hold(GARAGE_ROY_ID);

    expect(response.json()).toEqual(ALREADY_INSIDE_BODY);
    expect(spotHolds.drafts).toHaveLength(0);
  });

  it('grants Julie a hold while Marc is inside Parking Démo', async () => {
    const { hold, enter, marcHeaders, spotHolds } = await startWithJulieAndMarcReady();
    await enter(marcHeaders, entreeDemoQr);

    const response = await hold();

    expect(response.statusCode).toBe(201);
    expect(spotHolds.drafts).toHaveLength(1);
  });

  it('answers HOLD_ALREADY_EXISTS, not ALREADY_INSIDE, to Julie holding a spot at Parking Démo who entered Entrée Roy', async () => {
    const { hold, enter, julieHeaders, spotHolds } = await startWithJulieAndMarcReady();
    await hold();
    const entered = await enter(julieHeaders, entreeRoyQr);
    expect(entered.statusCode).toBe(201);

    const response = await hold(GARAGE_ROY_ID);

    expect(response.json()).toEqual({ statusCode: 409, error: 'HOLD_ALREADY_EXISTS', message: 'You already hold a spot.' });
    expect(spotHolds.drafts).toHaveLength(1);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ENTREE_DEMO_ID, ENTREE_ROY_ID } from '../../src/seed/fixtures/gates.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotGateRepository } from './fakes/fakeLotGateRepository.ts';
import { entreePrincipale, lotGateRoutesOf, settingsOf, type LotGateRoutes } from './fakes/lotGateRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';

type GateCall = (routes: LotGateRoutes, cookies: Cookies, gateId: string) => ReturnType<LotGateRoutes['readGates']>;

const EVERY_GATE_ROUTE: readonly (readonly [string, GateCall])[] = [
  ['reading the gates', (routes, cookies) => routes.readGates(cookies)],
  ['adding a gate', (routes, cookies) => routes.addGate(cookies, entreePrincipale)],
  ['changing a gate', (routes, cookies, gateId) => routes.changeGate(cookies, gateId, settingsOf(entreePrincipale))],
  ['regenerating its key', (routes, cookies, gateId) => routes.replaceDeviceKey(cookies, gateId)],
  ['regenerating its QR secret', (routes, cookies, gateId) => routes.replaceQrSecret(cookies, gateId)],
  ['reading its QR link', (routes, cookies, gateId) => routes.readQrLink(cookies, gateId)],
];

describe('who reaches the gate routes', () => {
  let server: FastifyInstance;
  let gates: FakeLotGateRepository;

  afterEach(() => server.close());

  function start() {
    ({ server, lotGates: gates } = startDashboardServer());
    return { roy: lotGateRoutesOf(server, GARAGE_ROY_ID), demo: lotGateRoutesOf(server, PARKING_DEMO_ID) };
  }

  function snapshot(): string {
    return JSON.stringify({ gates: gates.gates, keys: gates.deviceKeys });
  }

  it.each(EVERY_GATE_ROUTE)('answers Sophie 404 LOT_NOT_FOUND on Pierre’s lot when %s, and changes nothing', async (_case, call) => {
    const { roy } = start();
    const before = snapshot();

    const refused = await call(roy, await dashboardCookieFor(server, sophie), ENTREE_ROY_ID);

    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(refused.body).not.toMatch(/Entrée Roy|deviceKey|link/);
    expect(snapshot()).toBe(before);
  });

  it.each(EVERY_GATE_ROUTE.slice(2))('answers Pierre 404 GATE_NOT_FOUND for Sophie’s gate under his own lot when %s', async (_case, call) => {
    const { roy } = start();
    const before = snapshot();

    const refused = await call(roy, await dashboardCookieFor(server, pierre), ENTREE_DEMO_ID);

    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toMatchObject({ error: 'GATE_NOT_FOUND' });
    expect(snapshot()).toBe(before);
  });

  it.each(EVERY_GATE_ROUTE)('answers a visitor without a session 401 when %s', async (_case, call) => {
    const { roy } = start();

    expect((await call(roy, {}, ENTREE_ROY_ID)).statusCode).toBe(401);
  });

  it('answers a malformed gate id like another operator’s lot', async () => {
    const { roy } = start();

    const refused = await roy.readQrLink(await dashboardCookieFor(server, pierre), 'not-a-uuid');

    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
  });
});

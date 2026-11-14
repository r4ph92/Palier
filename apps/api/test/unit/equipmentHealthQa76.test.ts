import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EntryGate } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_ID, SORTIE_DEMO_ID } from '../../src/seed/fixtures/gates.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { nouvelOperateur, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, FakeEntryGateRepository } from './fakes/entryFakes.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports } from './fakes/gateFixtures.ts';
import { fakeGateDependencies, serverDependencies } from './fakes/serverDependencies.ts';

const SERVER_INSTANT = new Date('2026-11-13T19:05:00Z');
const AISLE_A_ID = '00000000-0000-4000-8000-000000000401';
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

function secondsFromServerInstant(seconds: number): Date {
  return new Date(SERVER_INSTANT.getTime() + seconds * 1000);
}

describe('QA #76: gate reports a controller cannot bend', () => {
  let server: FastifyInstance;
  let equipment: FakeEquipmentReports;

  afterEach(() => server.close());

  function startGateServer(): void {
    equipment = new FakeEquipmentReports();
    const testClock = createTestClock();
    testClock.setFixed(SERVER_INSTANT);
    server = buildServer(serverDependencies({ gates: { ...fakeGateDependencies(), equipment }, testClock, settings: { testSignInEnabled: true } }));
  }

  function reportBattery(minor: string, payload: unknown) {
    return server.inject({
      method: 'POST',
      url: `/v1/gates/${entreeDemo.id}/beacons/${minor}/battery`,
      headers: { authorization: `Bearer ${ENTREE_DEMO_KEY}`, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  }

  it('stamps a heartbeat with the server clock even when the controller sends a time of its own', async () => {
    startGateServer();

    const response = await server.inject({
      method: 'POST',
      url: `/v1/gates/${entreeDemo.id}/heartbeat`,
      headers: { authorization: `Bearer ${ENTREE_DEMO_KEY}` },
      payload: { at: '2030-01-01T00:00:00Z', lastHeartbeatAt: '2030-01-01T00:00:00Z' },
    });

    expect(response.statusCode).toBe(204);
    expect(equipment.heartbeats.get(entreeDemo.id)).toEqual(SERVER_INSTANT);
  });

  it.each([
    [0, 0],
    [100, 100],
  ])('records a device reading of %s percent as %i, the bounds included', async (percent, recorded) => {
    startGateServer();

    expect((await reportBattery('1', { percent })).statusCode).toBe(204);
    expect(equipment.batteries.map((reading) => reading.percent)).toEqual([recorded]);
  });

  it.each([
    ['a null percent', { percent: null }],
    ['a boolean percent', { percent: true }],
    ['a percent too large for any battery', { percent: 1e308 }],
    ['a body that is a list', [15]],
  ])('refuses %s with 400 and writes nothing', async (_case, payload) => {
    startGateServer();

    expect((await reportBattery('1', payload)).statusCode).toBe(400);
    expect(equipment.batteries).toEqual([]);
  });

  it('keeps only the percent of a reading that carries extra fields, never a time chosen by the controller', async () => {
    startGateServer();

    await reportBattery('1', { percent: 42, reportedAt: '2020-01-01T00:00:00Z', lotId: '00000000-0000-4000-8000-000000000203' });

    expect(equipment.batteries).toEqual([{ lotId: entreeDemo.lotId, beaconMinor: 1, percent: 42, reportedAt: SERVER_INSTANT }]);
  });

  it('looks up the highest beacon minor, 65535, but refuses 65536 before any lookup', async () => {
    startGateServer();
    equipment.beaconMinorsByLot.set(entreeDemo.lotId, [65535, 65536]);

    expect((await reportBattery('65535', { percent: 50 })).statusCode).toBe(204);
    expect((await reportBattery('65536', { percent: 50 })).json()).toMatchObject({ error: 'BEACON_NOT_FOUND' });
    expect(equipment.batteries.map((reading) => reading.beaconMinor)).toEqual([65535]);
  });
});

describe('QA #76: entries at a gate that stopped beating', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

  async function enterAsJulieWithoutCard(gate: EntryGate) {
    const configured = configureServer({ entryClock: () => SERVER_INSTANT, entryGates: new FakeEntryGateRepository([gate]) });
    server = configured.server;
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    const response = await server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr } });
    return { response, entries: configured.entries };
  }

  it('tells Julie, who has no card yet, that the silent gate is out of service rather than asking for a card', async () => {
    const { response, entries } = await enterAsJulieWithoutCard({ ...entreeDemoGate, lastHeartbeatAt: secondsFromServerInstant(-121) });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'GATE_SILENT' });
    expect(entries.payments.authorized).toEqual([]);
  });

  it('asks the same Julie for her card once the gate beats again', async () => {
    const { response } = await enterAsJulieWithoutCard({ ...entreeDemoGate, lastHeartbeatAt: secondsFromServerInstant(-5) });

    expect(response.json()).toMatchObject({ error: 'PREREQUISITES_MISSING' });
  });

  it('admits at a gate whose last beat is ahead of the clock, as after a test clock moved back (decision 036)', async () => {
    const { response } = await enterAsJulieWithoutCard({ ...entreeDemoGate, lastHeartbeatAt: secondsFromServerInstant(3600) });

    expect(response.json()).not.toMatchObject({ error: 'GATE_SILENT' });
  });
});

describe('QA #76: equipment seen from the dashboard', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function start() {
    const started = startDashboardServer();
    server = started.server;
    started.testClock?.setFixed(SERVER_INSTANT);
    return started;
  }

  it.each([
    ['Nouvel Opérateur, member of no operator', nouvelOperateur],
    ['Julie, a driver signed in to the dashboard', julie],
  ])('answers %s the same 404 on Parking Démo equipment and battery, and writes nothing', async (_case, user) => {
    start();
    const cookies = await dashboardCookieFor(server, user);

    const read = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/equipment`, cookies });
    const write = await server.inject({
      method: 'PUT',
      url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/aisles/${AISLE_A_ID}/beacon-battery`,
      cookies,
      headers: writeHeader,
      payload: { percent: 15 },
    });

    expect(read.json()).toEqual(LOT_NOT_FOUND);
    expect(write.json()).toEqual(LOT_NOT_FOUND);
    const sophieCookies = await dashboardCookieFor(server, sophie);
    const map = (await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/map`, cookies: sophieCookies })).json();
    expect(map.levels.flatMap((level: { aisles: { batteryPercent: number | null }[] }) => level.aisles.map((aisle) => aisle.batteryPercent))).not.toContain(15);
  });

  it('names a silent exit gate in the occupancy banner, and never a gate that was never heard', async () => {
    const { lotEquipment } = start();
    lotEquipment.stampHeartbeat(SORTIE_DEMO_ID, secondsFromServerInstant(-121));

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy`, cookies: await dashboardCookieFor(server, sophie) });

    expect(response.json()).toMatchObject({ silentGateNames: ['Sortie Démo'] });
  });

  it('lets a silent gate recover on the dashboard the moment it beats again', async () => {
    const { lotEquipment } = start();
    const cookies = await dashboardCookieFor(server, sophie);
    lotEquipment.stampHeartbeat(ENTREE_DEMO_ID, secondsFromServerInstant(-600));
    const silent = (await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/equipment`, cookies })).json();

    lotEquipment.stampHeartbeat(ENTREE_DEMO_ID, SERVER_INSTANT);
    const recovered = (await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/equipment`, cookies })).json();

    expect(silent.gates[0]).toMatchObject({ name: 'Entrée Démo', health: 'SILENT' });
    expect(recovered.gates[0]).toMatchObject({ name: 'Entrée Démo', health: 'ONLINE' });
  });
});

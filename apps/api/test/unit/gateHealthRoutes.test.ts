import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, REVOKED_KEY, SORTIE_DEMO_KEY, sortieDemo, UNKNOWN_KEY } from './fakes/gateFixtures.ts';
import { fakeGateDependencies, NOW, serverDependencies } from './fakes/serverDependencies.ts';

const TEST_CLOCK_INSTANT = new Date('2026-11-13T19:05:00Z');

function bearer(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` };
}

describe('gate health routes', () => {
  let server: FastifyInstance;
  let equipment: FakeEquipmentReports;

  afterEach(() => server.close());

  function startServer(): void {
    equipment = new FakeEquipmentReports();
    const testClock = createTestClock();
    testClock.setFixed(TEST_CLOCK_INSTANT);
    const gates = { ...fakeGateDependencies(), equipment };
    server = buildServer(serverDependencies({ gates, testClock, settings: { testSignInEnabled: true } }));
  }

  function heartbeat(gateId: string, key: string) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/heartbeat`, headers: bearer(key) });
  }

  function reportBattery(minor: string, payload: object, { key = ENTREE_DEMO_KEY, gateId = entreeDemo.id } = {}) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/beacons/${minor}/battery`, headers: bearer(key), payload });
  }

  describe('heartbeat', () => {
    it('stamps the gate with the test clock when it is active, not the gate clock of passages', async () => {
      startServer();

      const response = await heartbeat(entreeDemo.id, ENTREE_DEMO_KEY);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(equipment.heartbeats.get(entreeDemo.id)).toEqual(TEST_CLOCK_INSTANT);
      expect(TEST_CLOCK_INSTANT).not.toEqual(NOW);
    });

    it.each([
      ['an unknown key', UNKNOWN_KEY],
      ['a revoked key', REVOKED_KEY],
      ['no key at all', ''],
    ])('refuses %s with 401 and stamps nothing', async (_case, key) => {
      startServer();

      const response = await heartbeat(entreeDemo.id, key);

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: 'DEVICE_KEY_REFUSED' });
      expect(equipment.heartbeats.size).toBe(0);
    });

    it("refuses a valid key on another gate's id with 403 and stamps nothing", async () => {
      startServer();

      const response = await heartbeat(sortieDemo.id, ENTREE_DEMO_KEY);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'GATE_FORBIDDEN' });
      expect(equipment.heartbeats.size).toBe(0);
    });
  });

  describe('beacon battery report', () => {
    it("records the reading for the beacon with this minor in the gate's lot, stamped by the server", async () => {
      startServer();

      const response = await reportBattery('1', { percent: 15 });

      expect(response.statusCode).toBe(204);
      expect(equipment.batteries).toEqual([{ lotId: entreeDemo.lotId, beaconMinor: 1, percent: 15, reportedAt: TEST_CLOCK_INSTANT }]);
    });

    it("reports the exit lane's beacon, minor 0, like any other", async () => {
      startServer();

      expect((await reportBattery('0', { percent: 80 }, { key: SORTIE_DEMO_KEY, gateId: sortieDemo.id })).statusCode).toBe(204);
      expect(equipment.batteries.map(({ beaconMinor }) => beaconMinor)).toEqual([0]);
    });

    it.each(['7', '65536', '99999'])("answers 404 BEACON_NOT_FOUND for minor %s, which no beacon of the gate's lot has", async (minor) => {
      startServer();

      const response = await reportBattery(minor, { percent: 15 });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: 'BEACON_NOT_FOUND' });
      expect(equipment.batteries).toEqual([]);
    });

    it.each([-1, 101, 1.5])('refuses %p percent with the shared rule code', async (percent) => {
      startServer();

      const response = await reportBattery('1', { percent });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'BATTERY_PERCENT_INVALID' });
      expect(equipment.batteries).toEqual([]);
    });

    it.each([
      ['a percent sent as text', '1', { percent: '15' }],
      ['a body without a percent', '1', {}],
      ['a minor with a leading zero', '01', { percent: 15 }],
      ['a minor that is not a number', 'A', { percent: 15 }],
    ])('refuses %s with 400 and writes nothing', async (_case, minor, payload) => {
      startServer();

      expect((await reportBattery(minor, payload)).statusCode).toBe(400);
      expect(equipment.batteries).toEqual([]);
    });

    it('refuses an unknown key with 401 and writes nothing', async () => {
      startServer();

      expect((await reportBattery('1', { percent: 15 }, { key: UNKNOWN_KEY })).statusCode).toBe(401);
      expect(equipment.batteries).toEqual([]);
    });

    it("refuses a valid key on another gate's id with 403 and writes nothing", async () => {
      startServer();

      const response = await reportBattery('1', { percent: 15 }, { gateId: sortieDemo.id });

      expect(response.statusCode).toBe(403);
      expect(equipment.batteries).toEqual([]);
    });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { hashDeviceKey } from '../../src/domain/gates/hashDeviceKey.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { ENTREE_DEMO_KEY, entreeDemo, FakeEquipmentReports, FakeGateDeviceKeyRepository, FakePassageLedger, REVOKED_KEY, sortieDemo, UNKNOWN_KEY } from './fakes/gateFixtures.ts';
import { fakeGateDependencies, serverDependencies } from './fakes/serverDependencies.ts';

const TESTED_AT = new Date('2026-11-13T19:05:00Z');
const WITHOUT_LOOPS_KEY = 'withoutLoopsKey0000000000000000000000000000';
const entreeWithoutLoops = { ...entreeDemo, id: '00000000-0000-4000-8000-000000000703', name: 'Entrée Sans Boucle', hasLoops: false };

function secondsBefore(seconds: number): Date {
  return new Date(TESTED_AT.getTime() - seconds * 1000);
}

describe('gate test passage route', () => {
  let server: FastifyInstance;
  let equipment: FakeEquipmentReports;
  let ledger: FakePassageLedger;

  afterEach(() => server.close());

  function startServer(): void {
    equipment = new FakeEquipmentReports();
    ledger = new FakePassageLedger(7);
    const testClock = createTestClock();
    testClock.setFixed(TESTED_AT);
    const deviceKeys = new FakeGateDeviceKeyRepository().withGate(WITHOUT_LOOPS_KEY, entreeWithoutLoops);
    const gates = { ...fakeGateDependencies(), equipment, ledger, deviceKeys };
    server = buildServer(serverDependencies({ gates, testClock, settings: { testSignInEnabled: true } }));
  }

  function testPassage(gateId: string, key = ENTREE_DEMO_KEY) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/test-passage`, headers: { authorization: `Bearer ${key}` } });
  }

  it('verifies a gate heard one minute ago, stamped by the health clock, and counts no vehicle', async () => {
    startServer();
    equipment.heartbeats.set(entreeDemo.id, secondsBefore(60));

    const response = await testPassage(entreeDemo.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verifiedAt: TESTED_AT.toISOString() });
    expect(equipment.verifiedAt.get(entreeDemo.id)).toEqual(TESTED_AT);
    expect([ledger.vehicleCount, ledger.entries, ledger.replayed]).toEqual([7, [], []]);
  });

  it('verifies a gate heard exactly two minutes ago, the last moment it still reads as online', async () => {
    startServer();
    equipment.heartbeats.set(entreeDemo.id, secondsBefore(120));

    expect((await testPassage(entreeDemo.id)).statusCode).toBe(200);
  });

  it('verifies a gate without loops: the controller self-test is the check', async () => {
    startServer();
    equipment.heartbeats.set(entreeWithoutLoops.id, secondsBefore(5));

    expect((await testPassage(entreeWithoutLoops.id, WITHOUT_LOOPS_KEY)).statusCode).toBe(200);
  });

  it.each([
    ['never heard', null],
    ['last heard two minutes and one second ago', secondsBefore(121)],
  ])('answers 409 GATE_NOT_HEARD for a gate %s, and verifies nothing', async (_case, lastHeartbeatAt) => {
    startServer();
    if (lastHeartbeatAt !== null) {
      equipment.heartbeats.set(entreeDemo.id, lastHeartbeatAt);
    }

    const response = await testPassage(entreeDemo.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'GATE_NOT_HEARD' });
    expect(equipment.verifiedAt.size).toBe(0);
  });

  it.each([
    ['an unknown key', UNKNOWN_KEY, 401],
    ['a revoked key', REVOKED_KEY, 401],
  ])('refuses %s like a heartbeat, and verifies nothing', async (_case, key, statusCode) => {
    startServer();
    equipment.heartbeats.set(entreeDemo.id, secondsBefore(5));

    expect((await testPassage(entreeDemo.id, key)).statusCode).toBe(statusCode);
    expect(equipment.verifiedAt.size).toBe(0);
  });

  it('refuses with 409 GATE_NOT_HEARD a key revoked after the request was authenticated, and verifies nothing', async () => {
    startServer();
    equipment.heartbeats.set(entreeDemo.id, secondsBefore(5));
    equipment.revokedKeyHashes.add(hashDeviceKey(ENTREE_DEMO_KEY));

    const response = await testPassage(entreeDemo.id);

    expect([response.statusCode, response.json().error]).toEqual([409, 'GATE_NOT_HEARD']);
    expect(equipment.verifiedAt.size).toBe(0);
  });

  it("refuses a valid key on another gate's id with 403 GATE_FORBIDDEN, and verifies nothing", async () => {
    startServer();
    equipment.heartbeats.set(sortieDemo.id, secondsBefore(5));

    const response = await testPassage(sortieDemo.id);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'GATE_FORBIDDEN' });
    expect(equipment.verifiedAt.size).toBe(0);
  });
});

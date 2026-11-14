import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { TestClock } from '../../src/domain/time/TestClock.ts';
import { ENTREE_DEMO_ID, SORTIE_DEMO_ID } from '../../src/seed/fixtures/gates.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotEquipmentReader } from './fakes/fakeLotEquipmentReader.ts';

const LAST_BEAT = new Date('2026-11-13T19:05:00Z');
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

describe('GET /v1/dashboard/lots/:id/equipment', () => {
  let server: FastifyInstance;
  let testClock: TestClock;
  let lotEquipment: FakeLotEquipmentReader;

  afterEach(() => server.close());

  function start(): void {
    const started = startDashboardServer();
    server = started.server;
    lotEquipment = started.lotEquipment;
    if (started.testClock === undefined) {
      throw new Error('the dashboard server runs with test sign-in');
    }
    testClock = started.testClock;
  }

  async function equipmentOf(user: typeof sophie, lotId: string) {
    return server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/equipment`, cookies: await dashboardCookieFor(server, user) });
  }

  function secondsAfterLastBeat(seconds: number): Date {
    return new Date(LAST_BEAT.getTime() + seconds * 1000);
  }

  it('shows Sophie Entrée Démo online within 2 minutes of its heartbeat, and Sortie Démo never heard', async () => {
    start();
    lotEquipment.stampHeartbeat(ENTREE_DEMO_ID, LAST_BEAT);
    testClock.setFixed(secondsAfterLastBeat(30));

    const response = await equipmentOf(sophie, PARKING_DEMO_ID);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lotId: PARKING_DEMO_ID,
      lotName: 'Parking Démo',
      now: secondsAfterLastBeat(30).toISOString(),
      gates: [
        { id: ENTREE_DEMO_ID, name: 'Entrée Démo', kind: 'ENTRY', health: 'ONLINE', lastHeartbeatAt: LAST_BEAT.toISOString() },
        { id: SORTIE_DEMO_ID, name: 'Sortie Démo', kind: 'EXIT', health: 'NEVER_HEARD', lastHeartbeatAt: null },
      ],
    });
  });

  it('turns Entrée Démo silent once the test clock is more than 2 minutes past its last heartbeat', async () => {
    start();
    lotEquipment.stampHeartbeat(ENTREE_DEMO_ID, LAST_BEAT);
    testClock.setFixed(secondsAfterLastBeat(121));

    const [entreeDemo] = (await equipmentOf(sophie, PARKING_DEMO_ID)).json().gates;

    expect(entreeDemo).toMatchObject({ health: 'SILENT', lastHeartbeatAt: LAST_BEAT.toISOString() });
  });

  it('answers Pierre Roy the same 404 for Parking Démo as for an unknown id and a malformed one', async () => {
    start();

    for (const lotId of [PARKING_DEMO_ID, '00000000-0000-4000-8000-000000000999', 'not-a-uuid']) {
      const response = await equipmentOf(pierre, lotId);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(LOT_NOT_FOUND);
    }
  });

  it('lists the occupancy banner names from the same rule', async () => {
    start();
    lotEquipment.stampHeartbeat(ENTREE_DEMO_ID, LAST_BEAT);
    testClock.setFixed(secondsAfterLastBeat(121));

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/occupancy`, cookies: await dashboardCookieFor(server, sophie) });

    expect(response.json()).toMatchObject({ silentGateNames: ['Entrée Démo'] });
  });
});

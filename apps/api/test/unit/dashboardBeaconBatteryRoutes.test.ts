import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardLotMap, DashboardMapAisle } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotMapRepository } from './fakes/fakeLotMapRepository.ts';

const AISLE_A_ID = '00000000-0000-4000-8000-000000000401';
const EXIT_LANE_ID = '00000000-0000-4000-8000-000000000403';
const READ_AT = new Date('2026-11-13T19:05:00Z');
const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

describe('PUT /v1/dashboard/lots/:id/aisles/:aisleId/beacon-battery', () => {
  let server: FastifyInstance;
  let lotMaps: FakeLotMapRepository;

  afterEach(() => server.close());

  function start(): void {
    const started = startDashboardServer();
    server = started.server;
    lotMaps = started.lotMaps;
    started.testClock?.setFixed(READ_AT);
  }

  async function recordBattery(user: typeof sophie, { lotId = PARKING_DEMO_ID, aisleId = AISLE_A_ID, payload = { percent: 15 } as object } = {}) {
    const cookies = await dashboardCookieFor(server, user);
    return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${lotId}/aisles/${aisleId}/beacon-battery`, cookies, headers: writeHeader, payload });
  }

  function aisleOf(map: DashboardLotMap, aisleId: string): DashboardMapAisle | undefined {
    return map.levels.flatMap(({ aisles }) => aisles).find(({ id }) => id === aisleId);
  }

  function storedBatteries() {
    return lotMaps.levels.flatMap(({ aisles }) => aisles).map(({ batteryPercent }) => batteryPercent);
  }

  it("records Sophie's 15 % for aisle A's beacon and answers the map with a low battery stamped by the server", async () => {
    start();

    const response = await recordBattery(sophie);

    expect(response.statusCode).toBe(200);
    expect(aisleOf(response.json(), AISLE_A_ID)).toMatchObject({ batteryPercent: 15, batteryReportedAt: READ_AT.toISOString(), batteryStatus: 'LOW' });
  });

  it("records the exit lane's beacon like any other, and shows the others unknown", async () => {
    start();

    const map: DashboardLotMap = (await recordBattery(sophie, { aisleId: EXIT_LANE_ID, payload: { percent: 80 } })).json();

    expect(aisleOf(map, EXIT_LANE_ID)).toMatchObject({ batteryPercent: 80, batteryStatus: 'OK' });
    expect(aisleOf(map, AISLE_A_ID)).toMatchObject({ batteryPercent: null, batteryReportedAt: null, batteryStatus: 'UNKNOWN' });
  });

  it('answers Pierre Roy the same 404 for Parking Démo as for an unknown lot and a malformed id, and writes nothing', async () => {
    start();

    for (const target of [{}, { lotId: '00000000-0000-4000-8000-000000000999' }, { aisleId: 'not-a-uuid' }]) {
      const response = await recordBattery(pierre, target);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(LOT_NOT_FOUND);
    }
    expect(storedBatteries().every((percent) => percent === null)).toBe(true);
  });

  it("answers AISLE_NOT_FOUND for an aisle of another lot named under Pierre's own lot, and writes nothing", async () => {
    start();

    const response = await recordBattery(pierre, { lotId: GARAGE_ROY_ID });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'AISLE_NOT_FOUND' });
    expect(storedBatteries().every((percent) => percent === null)).toBe(true);
  });

  it.each([-1, 101, 1.5])('refuses %p percent with the shared rule code and writes nothing', async (percent) => {
    start();

    const response = await recordBattery(sophie, { payload: { percent } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'BATTERY_PERCENT_INVALID' });
    expect(storedBatteries().every((stored) => stored === null)).toBe(true);
  });

  it('refuses a percent sent as text with 400', async () => {
    start();

    expect((await recordBattery(sophie, { payload: { percent: '15' } })).statusCode).toBe(400);
  });
});

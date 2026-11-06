import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ActiveParkingSession } from '../../src/domain/parkingSessions/ActiveParkingSession.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { julieAtB3WithPlan, PARKING_DEMO_P1_AISLES } from './fakes/fakeCurrentParkingSessions.ts';

describe('GET /v1/me/session level plan (story #17)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function readJulieSession(session: ActiveParkingSession) {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const warn = vi.fn();
    server.addHook('onRequest', async (request) => {
      request.log.warn = warn;
    });
    configured.parkingSessions.add(julie.id, session);
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    const response = await server.inject({ method: 'GET', url: '/v1/me/session', headers });
    return { body: response.json(), warn };
  }

  it('gives Julie at B-3 the plan of level P1 with aisles A and B and the beacon major of Parking Démo', async () => {
    const { body } = await readJulieSession(julieAtB3WithPlan());

    expect(body).toMatchObject({
      session: {
        spot: { number: 'B-3', levelCode: 'P1', aisleCode: 'B' },
        beaconMajor: 1,
        levelPlan: {
          levelCode: 'P1',
          aisles: [
            { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } },
            { code: 'B', beaconMinor: 2, rectangle: { x: 0, y: 50, width: 100, height: 40 } },
          ],
        },
      },
    });
  });

  it('still serves the session when an aisle shape is malformed, with that aisle undrawn and one warning', async () => {
    const levelAisles = PARKING_DEMO_P1_AISLES.map((aisle) =>
      aisle.code === 'A' ? { ...aisle, mapPolygon: { x: 0, y: 0, width: 'large', height: 40 } } : aisle,
    );

    const { body, warn } = await readJulieSession({ ...julieAtB3WithPlan(), levelAisles });

    expect(body.session.levelPlan.aisles.map(({ code, rectangle }: { code: string; rectangle: unknown }) => [code, rectangle])).toEqual([
      ['A', null],
      ['B', { x: 0, y: 50, width: 100, height: 40 }],
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ aisleCode: 'A' }), expect.any(String));
  });

  it('logs nothing for aisles the operator has not drawn', async () => {
    const levelAisles = PARKING_DEMO_P1_AISLES.map((aisle) => ({ ...aisle, mapPolygon: null }));

    const { body, warn } = await readJulieSession({ ...julieAtB3WithPlan(), levelAisles });

    expect(body.session.levelPlan.aisles).toEqual([
      { code: 'A', beaconMinor: 1, rectangle: null },
      { code: 'B', beaconMinor: 2, rectangle: null },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers a null major and no plan for a lot without beacons or aisles', async () => {
    const { body } = await readJulieSession({ ...julieAtB3WithPlan(), beaconMajor: null, levelAisles: [] });

    expect(body).toMatchObject({ session: { beaconMajor: null, levelPlan: null } });
  });
});

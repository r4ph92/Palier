import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../src/domain/lots/LotAvailabilityRepository.ts';
import type { OnlineLot } from '../../src/domain/lots/OnlineLot.ts';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotStore } from './fakes/fakeLotSetupRepository.ts';
import { PARKING_DEMO_TARIFF, parkingDemoAvailability } from './fakes/lotFixtures.ts';
import { lotPublicationRoutesOf } from './fakes/lotPublicationRoutes.ts';
import { GARAGE_ROY_NORD_ID, readyGarageRoyNord } from './fakes/publicationFixtures.ts';

// The drivers' list reads the same lot store the go-live route writes, as the Postgres list reads parking_lot.is_online.
function availabilityReading(store: () => FakeLotStore): LotAvailabilityRepository {
  const onlineLotsOf = (lots: FakeLotStore): OnlineLot[] =>
    lots.owned
      .filter(({ isOnline }) => isOnline)
      .map(({ id, name, latitude, longitude }) => ({ id, name, location: { latitude: Number(latitude), longitude: Number(longitude) }, availability: parkingDemoAvailability(), tariff: PARKING_DEMO_TARIFF }));
  return { findOnlineLots: () => Promise.resolve(onlineLotsOf(store())) };
}

describe('going online, as the drivers see it (AC4)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('lists Garage Roy Nord in GET /v1/lots once Pierre puts it online, and no longer once he takes it offline', async () => {
    let lots: FakeLotStore | undefined;
    const started = startDashboardServer({ testSignInEnabled: true }, { lotAvailabilityRepository: availabilityReading(() => lots as FakeLotStore) });
    ({ server, lots } = started);
    started.lotPublication.withLot(ROY_OPERATOR_ID, readyGarageRoyNord());
    const routes = lotPublicationRoutesOf(server);
    const cookies = await dashboardCookieFor(server, pierre);
    await acceptNoticeAs(started.driverRepository, julie);
    const headers = await authorizationFor(started.driverRepository, julie);
    const listedIds = async () => (await server.inject({ method: 'GET', url: '/v1/lots', headers })).json<{ id: string }[]>().map(({ id }) => id);

    expect(await listedIds()).not.toContain(GARAGE_ROY_NORD_ID);
    expect((await routes.changeOnline(cookies, true)).statusCode).toBe(200);
    expect(await listedIds()).toContain(GARAGE_ROY_NORD_ID);
    expect((await routes.changeOnline(cookies, false)).statusCode).toBe(200);
    expect(await listedIds()).not.toContain(GARAGE_ROY_NORD_ID);
  });
});

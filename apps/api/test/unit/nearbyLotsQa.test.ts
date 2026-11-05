import { composeClock } from '../../src/composeClock.ts';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
import { freeSpotCount } from '../../src/domain/occupancy/freeSpotCount.ts';
import { freeSpotsByCategory } from '../../src/domain/occupancy/freeSpotsByCategory.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { onlineLotFromRow, type OnlineLotRow } from '../../src/infrastructure/postgres/onlineLotRow.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { dashboardCookieFor, DASHBOARD_COOKIE } from './fakes/dashboardServer.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { fakeOperatorStripe } from './fakes/fakeOperatorStripe.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { parkingDemoAvailability, parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const parkingDemo = parkingDemoOnline();

function startServer(lots = [parkingDemo], drivers = [julie, marc]) {
  const driverRepository = new FakeDriverRepository(drivers);
  const operatorRepository = new FakeOperatorRepository();
  const server = buildServer({
    gates: fakeGateDependencies(),
    repositories: fakeRepositories({ driverRepository, operatorRepository, vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: repositoryReturning(lots) }),
    operatorStripe: fakeOperatorStripe(operatorRepository).dependencies,
    testClock: composeClock(true).testClock,
    settings: { testSignInEnabled: true },
  });
  return { server, driverRepository };
}

describe('QA #5 GET /v1/lots as Julie', () => {
  let server: FastifyInstance;
  afterEach(() => server.close());

  async function getAsJulie(lots = [parkingDemo], url = '/v1/lots') {
    const started = startServer(lots);
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie);
    return server.inject({ method: 'GET', url, headers: await authorizationFor(started.driverRepository, julie) });
  }

  it.each([
    { vehicleCount: 0, total: 10, categories: { standard: 7, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 1, total: 9, categories: { standard: 7, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 3, total: 7, categories: { standard: 7, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 7, total: 3, categories: { standard: 3, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 8, total: 2, categories: { standard: 2, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 9, total: 1, categories: { standard: 1, electric: 1, accessible: 1, oversize: 1 } },
    { vehicleCount: 10, total: 0, categories: { standard: 0, electric: 0, accessible: 0, oversize: 0 } },
    { vehicleCount: 11, total: 0, categories: { standard: 0, electric: 0, accessible: 0, oversize: 0 } },
    { vehicleCount: 1_000_000, total: 0, categories: { standard: 0, electric: 0, accessible: 0, oversize: 0 } },
    { vehicleCount: 2_147_483_647, total: 0, categories: { standard: 0, electric: 0, accessible: 0, oversize: 0 } },
  ])('with $vehicleCount vehicles inside answers $total free spots and capped categories', async ({ vehicleCount, total, categories }) => {
    const response = await getAsJulie([parkingDemoOnline(parkingDemoAvailability({ vehicleCount }))]);

    expect(response.json()).toEqual([expect.objectContaining({ freeSpots: total, freeSpotsByCategory: categories })]);
  });

  const AVAILABILITY_GRID = [-5, 0, 4, 8, 9, 10, 99].flatMap((vehicleCount) =>
    [0, 1, 5, 10, 50].flatMap((capacity) =>
      [0, 1, 3, 10].map((availableSpotCount) =>
        parkingDemoAvailability({ vehicleCount, capacity, availableSpotCount, availableByCategory: { standard: 7, electric: 3, accessible: 3, oversize: 3 } }),
      ),
    ),
  );

  it.each(SPOT_CATEGORIES)('never lets the %s count pass the total, whatever the counts', (category) => {
    for (const availability of AVAILABILITY_GRID) {
      expect(freeSpotsByCategory(availability)[category]).toBeLessThanOrEqual(freeSpotCount(availability));
    }
  });

  it('never gives a negative total', () => {
    expect(AVAILABILITY_GRID.map(freeSpotCount).every((total) => total >= 0)).toBe(true);
  });

  it('shows no free spot for a lot whose capacity is 0 even with spots in the table', async () => {
    const response = await getAsJulie([parkingDemoOnline(parkingDemoAvailability({ capacity: 0 }))]);

    expect(response.json()).toEqual([expect.objectContaining({ freeSpots: 0, freeSpotsByCategory: { standard: 0, electric: 0, accessible: 0, oversize: 0 } })]);
  });

  it('counts a spot flagged electric, accessible and oversize once in the total and in each of its categories', async () => {
    const availability = parkingDemoAvailability({ availableSpotCount: 1, availableByCategory: { standard: 0, electric: 1, accessible: 1, oversize: 1 } });

    const response = await getAsJulie([parkingDemoOnline(availability)]);

    expect(response.json()).toEqual([expect.objectContaining({ freeSpots: 1, freeSpotsByCategory: { standard: 0, electric: 1, accessible: 1, oversize: 1 } })]);
  });

  it('ignores a position sent in the query: the position never changes the answer', async () => {
    const plain = await getAsJulie();
    await server.close();

    const withQuery = await getAsJulie([parkingDemo], '/v1/lots?latitude=45.5048&longitude=-73.5673');
    await server.close();
    const withGarbage = await getAsJulie([parkingDemo], '/v1/lots?latitude=abc&longitude=&latitude=1e999&__proto__=x');

    expect(withQuery.statusCode).toBe(200);
    expect(withQuery.json()).toEqual(plain.json());
    expect(withGarbage.statusCode).toBe(200);
    expect(withGarbage.json()).toEqual(plain.json());
  });

  it('returns lot names with markup, quotes, accents, emoji and a very long text untouched, as JSON', async () => {
    const names = ['<script>alert(1)</script>', "Robert'); DROP TABLE lots;--", 'Éric & Zoé 🚗 « Garage »', ' ', 'x'.repeat(5000)];

    const response = await getAsJulie(names.map((name, index) => ({ ...parkingDemo, id: `lot-${index}`, name })));

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json<{ name: string }[]>().map(({ name }) => name)).toEqual(names);
  });

  it('answers a lot at the null island (0, 0) with its coordinates, not as a lot without location', async () => {
    const response = await getAsJulie([{ ...parkingDemo, location: { latitude: 0, longitude: 0 } }]);

    expect(response.json()).toEqual([expect.objectContaining({ location: { latitude: 0, longitude: 0 } })]);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('does not accept %s on the lot list', async (method) => {
    const started = startServer();
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie);

    const response = await server.inject({ method, url: '/v1/lots', headers: await authorizationFor(started.driverRepository, julie) });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.body).not.toContain('Parking Démo');
  });
});

describe('QA #5 GET /v1/lots access', () => {
  let server: FastifyInstance;
  afterEach(() => server.close());

  function expectNoLotData(body: string): void {
    expect(body).not.toContain('Parking Démo');
    expect(body).not.toMatch(/freeSpots|location|latitude|longitude|standard|oversize/);
  }

  it('answers 401 and no lot field to a dashboard session token sent as an app bearer token', async () => {
    const started = startServer([parkingDemo], [julie, marc, sophie, pierre, nouvelOperateur]);
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie);
    const dashboardToken = (await dashboardCookieFor(server, julie))[DASHBOARD_COOKIE];

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: { authorization: `Bearer ${dashboardToken}` } });

    expect(response.statusCode).toBe(401);
    expectNoLotData(response.body);
  });

  it('answers 401 and no lot field to the dashboard cookie alone', async () => {
    const started = startServer([parkingDemo], [julie, marc, sophie, pierre, nouvelOperateur]);
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: '/v1/lots', cookies: await dashboardCookieFor(server, julie) });

    expect(response.statusCode).toBe(401);
    expectNoLotData(response.body);
  });

  it('answers 403 CONSENT_REQUIRED and no lot field to a driver who has not accepted the notice', async () => {
    const started = startServer();
    server = started.server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: await authorizationFor(started.driverRepository, marc) });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expectNoLotData(response.body);
  });

  it('answers 403 to a driver who accepted an older notice version', async () => {
    const started = startServer();
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie, 'an-older-version');

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: await authorizationFor(started.driverRepository, julie) });

    expect(response.statusCode).toBe(403);
    expectNoLotData(response.body);
  });

  it.each([
    ['a lowercase scheme with an unknown token', 'bearer nope'],
    ['a token with a query string', 'Bearer abc?x=1'],
    ['a very long token', `Bearer ${'a'.repeat(100_000)}`],
    ['two schemes', 'Bearer a Bearer b'],
  ])('answers 401 with %s', async (_case, authorization) => {
    const started = startServer();
    server = started.server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: { authorization } });

    expect(response.statusCode).toBe(401);
    expectNoLotData(response.body);
  });
});

describe('QA #5 onlineLotFromRow with hostile rows', () => {
  const row: OnlineLotRow = {
    id: 'lot',
    name: 'Lot',
    latitude: '45.501650',
    longitude: '-73.567300',
    capacity: 10,
    vehicleCount: 0,
    heldSpotCount: 0,
  };

  it.each([
    { label: 'zero coordinates', latitude: '0.000000', longitude: '0.000000', location: { latitude: 0, longitude: 0 } },
    { label: 'the extreme west', latitude: '0.000000', longitude: '-180.000000', location: { latitude: 0, longitude: -180 } },
    { label: 'the poles', latitude: '-90.000000', longitude: '180.000000', location: { latitude: -90, longitude: 180 } },
  ])('keeps $label as a location', ({ latitude, longitude, location }) => {
    expect(onlineLotFromRow({ ...row, latitude, longitude }, []).location).toEqual(location);
  });

  it('gives a lot with an empty-string coordinate pair no NaN in its location', () => {
    const { location } = onlineLotFromRow({ ...row, latitude: '', longitude: '' }, []);

    expect(location === null || (Number.isFinite(location.latitude) && Number.isFinite(location.longitude))).toBe(true);
  });
});

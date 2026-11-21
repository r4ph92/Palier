import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../src/domain/lots/LotAvailabilityRepository.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import type { Driver } from '../../src/domain/drivers/Driver.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { PARKING_DEMO_CATEGORIES, PARKING_DEMO_CATEGORIES_WITH_8_INSIDE, parkingDemoAvailability, parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const parkingDemo = parkingDemoOnline();

describe('GET /v1/lots', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;

  afterEach(() => server.close());

  async function listLotsAsJulie(lotAvailabilityRepository: LotAvailabilityRepository) {
    driverRepository = new FakeDriverRepository();
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository, driverRepository }) });
    await acceptNoticeAs(driverRepository, julie);
    const headers = await authorizationFor(driverRepository, julie);
    return server.inject({ method: 'GET', url: '/v1/lots', headers });
  }

  it('lists each online lot with its free spots, capacity, free spots by category, location and tariff', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: parkingDemo.id,
        name: 'Parking Démo',
        freeSpots: 10,
        capacity: 10,
        freeSpotsByCategory: PARKING_DEMO_CATEGORIES,
        location: parkingDemo.location,
        tariff: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
      },
    ]);
  });

  it('exposes only the id, name, counts, capacity, location and tariff', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(Object.keys(response.json<object[]>()[0] ?? {}).sort()).toEqual(['capacity', 'freeSpots', 'freeSpotsByCategory', 'id', 'location', 'name', 'tariff']);
  });

  it('answers a lot whose price cannot be read with a null tariff', async () => {
    const response = await listLotsAsJulie(repositoryReturning([{ ...parkingDemo, tariff: null }]));

    expect(response.json()).toEqual([expect.objectContaining({ tariff: null })]);
  });

  it('shows 2 free spots and no category above 2 when 8 vehicles are inside while every spot is free', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemoOnline(parkingDemoAvailability({ vehicleCount: 8 }))]));

    expect(response.json()).toEqual([
      expect.objectContaining({ freeSpots: 2, capacity: 10, freeSpotsByCategory: PARKING_DEMO_CATEGORIES_WITH_8_INSIDE }),
    ]);
  });

  it('answers a lot without coordinates with a null location', async () => {
    const response = await listLotsAsJulie(repositoryReturning([{ ...parkingDemo, location: null }]));

    expect(response.json()).toEqual([expect.objectContaining({ location: null })]);
  });

  it('keeps the order the repository gives', async () => {
    const paliers = { ...parkingDemo, id: 'paliers', name: 'Parking Test Paliers' };

    const response = await listLotsAsJulie(repositoryReturning([parkingDemo, paliers]));

    expect(response.json<{ id: string }[]>().map(({ id }) => id)).toEqual([parkingDemo.id, 'paliers']);
  });

  it('returns an empty list when no lot is online', async () => {
    const response = await listLotsAsJulie(repositoryReturning([]));

    expect(response.json()).toEqual([]);
  });

  it('answers 500 when the repository fails', async () => {
    const response = await listLotsAsJulie({ findOnlineLots: () => Promise.reject(new Error('down')) });

    expect(response.statusCode).toBe(500);
  });
});

describe('GET /v1/lots without a valid driver token', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function listLotsWith(headers: Record<string, string>) {
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: repositoryReturning([parkingDemo]), driverRepository: new FakeDriverRepository() }) });
    return server.inject({ method: 'GET', url: '/v1/lots', headers });
  }

  it('answers 401 without an Authorization header', async () => {
    const response = await listLotsWith({});

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain('Parking Démo');
    expect(response.body).not.toMatch(/freeSpots|location|latitude/);
  });

  it.each([
    ['an unknown token', 'Bearer not-a-real-token'],
    ['an empty bearer token', 'Bearer '],
    ['another scheme', 'Basic anVsaWU6cGFzcw=='],
  ])('answers 401 with %s', async (_case, authorization) => {
    const response = await listLotsWith({ authorization });

    expect(response.statusCode).toBe(401);
  });
});

// The position stays on the phone (decision 015): the list route takes no parameter, and a request carrying one gets no lot.
describe('GET /v1/lots with query parameters', () => {
  const POSITION_QUERY = '?latitude=45.5&longitude=-73.5';
  const nadia: Driver = { id: '00000000-0000-4000-8000-000000000504', firstName: 'Nadia', lastName: 'Bouchard' };
  let server: FastifyInstance;
  let findOnlineLots: LotAvailabilityRepository['findOnlineLots'];
  let driverRepository: FakeDriverRepository;

  afterEach(() => server.close());

  function startServer() {
    findOnlineLots = vi.fn(() => Promise.resolve([parkingDemo]));
    driverRepository = new FakeDriverRepository([julie, nadia]);
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: { findOnlineLots }, driverRepository }) });
  }

  it.each([
    ['a position', POSITION_QUERY],
    ['one coordinate', '?latitude=45.5'],
    ['any other parameter', '?limit=1000'],
    ['an empty parameter', '?latitude='],
  ])('answers 400 to Julie with %s, without reading or returning any lot', async (_case, query) => {
    startServer();
    await acceptNoticeAs(driverRepository, julie);
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: `/v1/lots${query}`, headers });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'QUERY_NOT_ALLOWED' });
    expect(response.body).not.toMatch(/Parking Démo|45\.5|-73\.5/);
    expect(findOnlineLots).not.toHaveBeenCalled();
  });

  it('still answers 401 to a request without a session', async () => {
    startServer();

    const response = await server.inject({ method: 'GET', url: `/v1/lots${POSITION_QUERY}` });

    expect(response.statusCode).toBe(401);
    expect(findOnlineLots).not.toHaveBeenCalled();
  });

  it('still answers 403 to Nadia Bouchard, who has not accepted the notice', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, nadia);

    const response = await server.inject({ method: 'GET', url: `/v1/lots${POSITION_QUERY}`, headers });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(findOnlineLots).not.toHaveBeenCalled();
  });
});

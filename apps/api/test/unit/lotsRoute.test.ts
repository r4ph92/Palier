import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../src/domain/lots/LotAvailabilityRepository.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { PARKING_DEMO_CATEGORIES, parkingDemoAvailability, parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';
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

  it('lists each online lot with its free spots, free spots by category and location', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: parkingDemo.id, name: 'Parking Démo', freeSpots: 10, freeSpotsByCategory: PARKING_DEMO_CATEGORIES, location: parkingDemo.location },
    ]);
  });

  it('exposes only the id, name, counts and location', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(Object.keys(response.json<object[]>()[0] ?? {}).sort()).toEqual(['freeSpots', 'freeSpotsByCategory', 'id', 'location', 'name']);
  });

  it('shows 2 free spots and no category above 2 when 8 vehicles are inside while every spot is free', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemoOnline(parkingDemoAvailability({ vehicleCount: 8 }))]));

    expect(response.json()).toEqual([
      expect.objectContaining({ freeSpots: 2, freeSpotsByCategory: { standard: 2, electric: 1, accessible: 1, oversize: 1 } }),
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

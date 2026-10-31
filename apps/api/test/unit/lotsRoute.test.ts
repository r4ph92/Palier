import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../src/domain/lots/LotAvailabilityRepository.ts';
import type { LotAvailability } from '../../src/domain/occupancy/LotAvailability.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';

const parkingDemo: LotAvailability = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Parking Démo',
  capacity: 10,
  vehicleCount: 0,
  availableSpotCount: 10,
};

function repositoryReturning(lots: readonly LotAvailability[]): LotAvailabilityRepository {
  return { findOnlineLots: () => Promise.resolve(lots) };
}

describe('GET /v1/lots', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;

  afterEach(() => server.close());

  async function listLotsAsJulie(lotAvailabilityRepository: LotAvailabilityRepository) {
    driverRepository = new FakeDriverRepository();
    server = buildServer({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository, driverRepository });
    await acceptNoticeAs(driverRepository, julie);
    const headers = await authorizationFor(driverRepository, julie);
    return server.inject({ method: 'GET', url: '/v1/lots', headers });
  }

  it('lists each online lot with its free spot count', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: parkingDemo.id, name: 'Parking Démo', freeSpots: 10 }]);
  });

  it('exposes only the id, name and free spot count', async () => {
    const response = await listLotsAsJulie(repositoryReturning([parkingDemo]));

    expect(Object.keys(response.json<object[]>()[0] ?? {}).sort()).toEqual(['freeSpots', 'id', 'name']);
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
    server = buildServer({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: repositoryReturning([parkingDemo]), driverRepository: new FakeDriverRepository() });
    return server.inject({ method: 'GET', url: '/v1/lots', headers });
  }

  it('answers 401 without an Authorization header', async () => {
    const response = await listLotsWith({});

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain('Parking Démo');
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

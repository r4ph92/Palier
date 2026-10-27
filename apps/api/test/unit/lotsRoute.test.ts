import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../src/domain/lots/LotAvailabilityRepository.ts';
import type { LotAvailability } from '../../src/domain/occupancy/LotAvailability.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { serverDependencies } from './fakes/serverDependencies.ts';

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

  afterEach(() => server.close());

  it('lists each online lot with its free spot count', async () => {
    server = buildServer(serverDependencies({ lotAvailabilityRepository: repositoryReturning([parkingDemo]) }));

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: parkingDemo.id, name: 'Parking Démo', freeSpots: 10 }]);
  });

  it('exposes only the id, name and free spot count', async () => {
    server = buildServer(serverDependencies({ lotAvailabilityRepository: repositoryReturning([parkingDemo]) }));

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(Object.keys(response.json<object[]>()[0] ?? {}).sort()).toEqual(['freeSpots', 'id', 'name']);
  });

  it('returns an empty list when no lot is online', async () => {
    server = buildServer(serverDependencies({ lotAvailabilityRepository: repositoryReturning([]) }));

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.json()).toEqual([]);
  });

  it('answers 500 when the repository fails', async () => {
    server = buildServer(serverDependencies({ lotAvailabilityRepository: { findOnlineLots: () => Promise.reject(new Error('down')) } }));

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(500);
  });
});

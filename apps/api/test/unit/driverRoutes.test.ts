import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

describe('driver routes', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;

  afterEach(() => server.close());

  function startServer() {
    driverRepository = new FakeDriverRepository();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository });
  }

  it('GET /v1/me returns the signed-in driver’s id and first name only', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: '/v1/me', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: julie.id, firstName: 'Julie' });
  });

  it('GET /v1/me answers 401 without a token', async () => {
    startServer();

    const response = await server.inject({ method: 'GET', url: '/v1/me' });

    expect(response.statusCode).toBe(401);
  });

  it('POST /v1/sign-out answers 204, then the old token is refused', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const signOut = await server.inject({ method: 'POST', url: '/v1/sign-out', headers });
    const lotsAfter = await server.inject({ method: 'GET', url: '/v1/lots', headers });

    expect(signOut.statusCode).toBe(204);
    expect(lotsAfter.statusCode).toBe(401);
  });

  it('POST /v1/sign-out answers 401 without a token', async () => {
    startServer();

    const response = await server.inject({ method: 'POST', url: '/v1/sign-out' });

    expect(response.statusCode).toBe(401);
  });
});

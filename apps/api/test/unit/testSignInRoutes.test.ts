import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { buildServer } from '../../src/http/buildServer.ts';
import { julie, marc, FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

describe('test sign-in when enabled', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function startServer() {
    server = buildServer({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: noLots, driverRepository: new FakeDriverRepository(), testSignInEnabled: true });
  }

  it('lists the seeded drivers to pick from', async () => {
    startServer();

    const response = await server.inject({ method: 'GET', url: '/v1/test/drivers' });

    expect(response.json()).toEqual([julie, marc]);
  });

  it('signs Julie in, and her token opens the lots list', async () => {
    startServer();

    const signIn = await server.inject({ method: 'POST', url: '/v1/test/sign-in', payload: { driverId: julie.id } });
    const { token, driver } = signIn.json<{ token: string; driver: object }>();
    const authorization = { authorization: `Bearer ${token}` };
    await server.inject({ method: 'POST', url: '/v1/consent', headers: authorization, payload: { noticeVersion: PRIVACY_NOTICE_VERSION } });
    const lots = await server.inject({ method: 'GET', url: '/v1/lots', headers: authorization });

    expect(signIn.statusCode).toBe(200);
    expect(driver).toEqual({ id: julie.id, firstName: 'Julie' });
    expect(lots.statusCode).toBe(200);
  });

  it('answers 404 for an unknown driver', async () => {
    startServer();

    const response = await server.inject({
      method: 'POST',
      url: '/v1/test/sign-in',
      payload: { driverId: '00000000-0000-4000-8000-000000000599' },
    });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['a driver id that is not a uuid', { driverId: 'julie' }],
    ['no driver id', {}],
  ])('answers 400 for %s', async (_case, payload) => {
    startServer();

    const response = await server.inject({ method: 'POST', url: '/v1/test/sign-in', payload });

    expect(response.statusCode).toBe(400);
  });
});

describe('test sign-in body', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('drops extra fields instead of using them', async () => {
    server = buildServer({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: noLots, driverRepository: new FakeDriverRepository(), testSignInEnabled: true });

    const response = await server.inject({
      method: 'POST',
      url: '/v1/test/sign-in',
      payload: { driverId: julie.id, firstName: 'Admin' },
    });

    expect(response.json<{ driver: object }>().driver).toEqual({ id: julie.id, firstName: 'Julie' });
  });
});

describe('test sign-in when disabled', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function startServer() {
    server = buildServer({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: noLots, driverRepository: new FakeDriverRepository() });
  }

  it('GET /v1/test/drivers answers 404', async () => {
    startServer();

    const response = await server.inject({ method: 'GET', url: '/v1/test/drivers' });

    expect(response.statusCode).toBe(404);
  });

  it('POST /v1/test/sign-in answers 404 even for a real driver', async () => {
    startServer();

    const response = await server.inject({ method: 'POST', url: '/v1/test/sign-in', payload: { driverId: julie.id } });

    expect(response.statusCode).toBe(404);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

describe('driver routes', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;

  afterEach(() => server.close());

  function startServer() {
    driverRepository = new FakeDriverRepository();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository });
  }

  it('GET /v1/me returns the signed-in driver’s id, first name and accepted notice version', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: '/v1/me', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: julie.id, firstName: 'Julie', acceptedNoticeVersion: null });
  });

  it('GET /v1/me reports the notice version the driver accepted', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);
    await acceptNoticeAs(driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: '/v1/me', headers });

    expect(response.json<{ acceptedNoticeVersion: string }>().acceptedNoticeVersion).toBe(PRIVACY_NOTICE_VERSION);
  });

  it('POST /v1/consent records the current notice and answers 204', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const accept = await server.inject({ method: 'POST', url: '/v1/consent', headers, payload: { noticeVersion: PRIVACY_NOTICE_VERSION } });
    const me = await server.inject({ method: 'GET', url: '/v1/me', headers });

    expect(accept.statusCode).toBe(204);
    expect(me.json<{ acceptedNoticeVersion: string }>().acceptedNoticeVersion).toBe(PRIVACY_NOTICE_VERSION);
  });

  it('POST /v1/consent answers 409 for a notice version that is not in force, and records nothing', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const accept = await server.inject({ method: 'POST', url: '/v1/consent', headers, payload: { noticeVersion: '2020-01-01' } });
    const me = await server.inject({ method: 'GET', url: '/v1/me', headers });

    expect(accept.statusCode).toBe(409);
    expect(me.json<{ acceptedNoticeVersion: string | null }>().acceptedNoticeVersion).toBeNull();
  });

  it('POST /v1/consent answers 401 without a token', async () => {
    startServer();

    const response = await server.inject({ method: 'POST', url: '/v1/consent', payload: { noticeVersion: PRIVACY_NOTICE_VERSION } });

    expect(response.statusCode).toBe(401);
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

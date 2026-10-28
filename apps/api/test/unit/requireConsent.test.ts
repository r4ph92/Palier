import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/http/buildServer.ts';
import { requireConsent } from '../../src/http/requireConsent.ts';
import { requireDriver } from '../../src/http/requireDriver.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };
const OUTDATED_VERSION = '2020-01-01';

describe('requireConsent on a driver route', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('refuses a driver who has never accepted the notice, and the handler does not run', async () => {
    const driverRepository = new FakeDriverRepository();
    const writeToDriverRecord = vi.fn();
    server = Fastify();
    server.post('/guarded', { preHandler: [requireDriver(driverRepository), requireConsent(driverRepository)] }, async () => {
      writeToDriverRecord();
      return { saved: true };
    });
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: 'POST', url: '/guarded', headers });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(writeToDriverRecord).not.toHaveBeenCalled();
  });

  it('refuses a driver who accepted an older notice version when a newer one is in force', async () => {
    const driverRepository = new FakeDriverRepository();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository });
    const headers = await authorizationFor(driverRepository, julie);
    await acceptNoticeAs(driverRepository, julie, OUTDATED_VERSION);

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers });

    expect(response.statusCode).toBe(403);
  });

  it('lets a driver who accepted the current notice through', async () => {
    const driverRepository = new FakeDriverRepository();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository });
    const headers = await authorizationFor(driverRepository, julie);
    await acceptNoticeAs(driverRepository, julie, PRIVACY_NOTICE_VERSION);

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers });

    expect(response.statusCode).toBe(200);
  });

  it('still answers 401, not 403, without a token', async () => {
    const driverRepository = new FakeDriverRepository();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository });

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(401);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { errorOf, GATED, methodOf, urlOf } from './routeClassification.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';

describe('consent guard on every gated route', () => {
  let server: FastifyInstance | undefined;

  afterEach(() => server?.close());

  it.each(GATED)('%s answers 401 without a token, before consent is checked', async (route) => {
    server = configureServer().server;

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route) });

    expect(response.statusCode).toBe(401);
  });

  it.each(GATED)('%s answers 403 CONSENT_REQUIRED for a driver who has not accepted the notice', async (route) => {
    const { server: guardedServer, driverRepository } = configureServer();
    server = guardedServer;
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), headers });

    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe('CONSENT_REQUIRED');
  });

  it.each(GATED)('%s is not refused for consent to a driver who accepted the current notice', async (route) => {
    const { server: guardedServer, driverRepository } = configureServer();
    server = guardedServer;
    const headers = await authorizationFor(driverRepository, julie);
    await acceptNoticeAs(driverRepository, julie);

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), headers });

    expect(errorOf(response)).not.toBe('CONSENT_REQUIRED');
  });
});

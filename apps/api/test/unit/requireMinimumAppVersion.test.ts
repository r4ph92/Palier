import { APP_VERSION_HEADER } from '@palier/shared-types/appVersion';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';

const MINIMUM = '1.2.0';
const UPDATE_REQUIRED = 426;
const UNAUTHORIZED = 401;

describe('minimum app version', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it.each(['1.1.9', '0.9', '1.1'])('answers 426 APP_UPDATE_REQUIRED to version %s, before any route runs', async (version) => {
    server = configureServer({ minimumAppVersion: MINIMUM }).server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: { [APP_VERSION_HEADER]: version } });

    expect(response.statusCode).toBe(UPDATE_REQUIRED);
    expect(response.json()).toMatchObject({ error: 'APP_UPDATE_REQUIRED' });
  });

  it.each(['1.2.0', '1.2', '1.10.0', '2.0.0'])('lets version %s through to the route', async (version) => {
    server = configureServer({ minimumAppVersion: MINIMUM }).server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: { [APP_VERSION_HEADER]: version } });

    expect(response.statusCode).toBe(UNAUTHORIZED);
  });

  it.each(['', 'latest', '1.2.x'])('answers 426 to an unreadable version "%s"', async (version) => {
    server = configureServer({ minimumAppVersion: MINIMUM }).server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots', headers: { [APP_VERSION_HEADER]: version } });

    expect(response.statusCode).toBe(UPDATE_REQUIRED);
  });

  it('answers 426 to an app that does not send the version header at all', async () => {
    server = configureServer({ minimumAppVersion: MINIMUM }).server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(UPDATE_REQUIRED);
  });

  it('checks no version when no minimum is configured', async () => {
    server = configureServer().server;

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(UNAUTHORIZED);
  });
});

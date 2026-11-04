import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer, registeredRoutes } from './configureServer.ts';
import { DASHBOARD_PROTECTED, DASHBOARD_ROUTES, EXEMPT, errorOf, GATED, methodOf, urlOf } from './routeClassification.ts';
import { writeHeader } from './fakes/dashboardServer.ts';
import { authorizationFor, julie } from './fakeDriverRepository.ts';

describe('route classification', () => {
  let server: FastifyInstance | undefined;

  afterEach(() => server?.close());

  it('has gated routes to check, so the consent checks are not vacuous', () => {
    expect(GATED.length).toBeGreaterThan(0);
  });

  it('lists every route the server registers, once, as gated, exempt or dashboard', async () => {
    server = configureServer({ testSignInEnabled: true, demoMode: true }).server;

    expect((await registeredRoutes(server)).sort()).toEqual([...GATED, ...EXEMPT, ...DASHBOARD_ROUTES].sort());
  });

  it.each(EXEMPT)('%s does not check consent for a driver who has not accepted the notice', async (route) => {
    const { server: exemptServer, driverRepository } = configureServer({ testSignInEnabled: true, demoMode: true });
    server = exemptServer;
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), headers });

    expect(errorOf(response)).not.toBe('CONSENT_REQUIRED');
  });

  it.each(DASHBOARD_PROTECTED)('%s answers 401 without a dashboard cookie', async (route) => {
    server = configureServer().server;

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), headers: writeHeader });

    expect(response.statusCode).toBe(401);
  });

  it.each(DASHBOARD_PROTECTED)('%s answers 401 to Julie\'s app token', async (route) => {
    const { server: dashboardServer, driverRepository } = configureServer();
    server = dashboardServer;
    const headers = { ...writeHeader, ...(await authorizationFor(driverRepository, julie)) };

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), headers });

    expect(response.statusCode).toBe(401);
  });
});

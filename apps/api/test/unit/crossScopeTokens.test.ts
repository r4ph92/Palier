import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { acceptNoticeAs, julie } from './fakeDriverRepository.ts';
import { dashboardCookieFor, DASHBOARD_COOKIE, startDashboardServer } from './fakes/dashboardServer.ts';

describe('tokens across the app and the dashboard', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('refuses Julie\'s dashboard token sent as an app bearer token', async () => {
    const started = startDashboardServer();
    server = started.server;
    await acceptNoticeAs(started.driverRepository, julie);
    const dashboardToken = (await dashboardCookieFor(server, julie))[DASHBOARD_COOKIE];

    const response = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers: { authorization: `Bearer ${dashboardToken}` } });

    expect(response.statusCode).toBe(401);
  });
});

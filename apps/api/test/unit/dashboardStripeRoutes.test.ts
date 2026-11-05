import { composeClock } from '../../src/composeClock.ts';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { ROY_OPERATOR_ID, LAVOIE_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { ONBOARDING_URL } from './fakes/fakeOperatorStripe.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const OPERATOR_NOT_FOUND = { statusCode: 404, error: 'OPERATOR_NOT_FOUND', message: 'No such operator.' };

describe('connecting Stripe from the dashboard', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function post(operatorId: string, cookies: Record<string, string>, headers: Record<string, string> = writeHeader) {
    return server.inject({ method: 'POST', url: `/v1/dashboard/operators/${operatorId}/stripe-onboarding`, cookies, headers });
  }

  it('sends Pierre to the hosted onboarding, and his operator then shows as pending', async () => {
    const started = startDashboardServer();
    server = started.server;
    const cookies = await dashboardCookieFor(server, pierre);

    const response = await post(ROY_OPERATOR_ID, cookies);
    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ url: string }>().url.startsWith(ONBOARDING_URL)).toBe(true);
    expect(me.json<{ operator: { kycStatus: string } }>().operator.kycStatus).toBe('PENDING');
    expect(started.gateway.createdFor).toEqual([ROY_OPERATOR_ID]);
  });

  it('gives Pierre a fresh link on the same account when he resumes', async () => {
    const started = startDashboardServer();
    server = started.server;
    const cookies = await dashboardCookieFor(server, pierre);

    await post(ROY_OPERATOR_ID, cookies);
    const resumed = await post(ROY_OPERATOR_ID, cookies);

    expect(resumed.statusCode).toBe(200);
    expect(started.gateway.createdFor).toHaveLength(1);
    expect(started.gateway.linksFor).toHaveLength(2);
  });

  it("gives Sophie not found when she starts the onboarding of Pierre's operator, and calls Stripe not at all", async () => {
    const started = startDashboardServer();
    server = started.server;
    const cookies = await dashboardCookieFor(server, sophie);

    const response = await post(ROY_OPERATOR_ID, cookies);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(OPERATOR_NOT_FOUND);
    expect(started.gateway.createdFor).toEqual([]);
    expect(started.gateway.linksFor).toEqual([]);
  });

  it("gives Sophie not found when she reads Pierre's operator, and Pierre can read his own", async () => {
    server = startDashboardServer().server;
    const sophieCookies = await dashboardCookieFor(server, sophie);
    const pierreCookies = await dashboardCookieFor(server, pierre);

    const refused = await server.inject({ method: 'GET', url: `/v1/dashboard/operators/${ROY_OPERATOR_ID}`, cookies: sophieCookies });
    const own = await server.inject({ method: 'GET', url: `/v1/dashboard/operators/${ROY_OPERATOR_ID}`, cookies: pierreCookies });

    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toEqual(OPERATOR_NOT_FOUND);
    expect(own.json()).toMatchObject({ id: ROY_OPERATOR_ID, legalName: 'Garages Roy' });
  });

  it.each([
    ['an unknown operator id', '00000000-0000-4000-8000-0000000009ff'],
    ['a malformed id', 'abc'],
  ])('gives the same not found for %s', async (_case, operatorId) => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, pierre);

    const started = await post(operatorId, cookies);
    const read = await server.inject({ method: 'GET', url: `/v1/dashboard/operators/${operatorId}`, cookies });

    expect([started.statusCode, started.json(), read.statusCode, read.json()]).toEqual([404, OPERATOR_NOT_FOUND, 404, OPERATOR_NOT_FOUND]);
  });

  it('gives a user who has no operator not found', async () => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, nouvelOperateur);

    expect((await post(LAVOIE_OPERATOR_ID, cookies)).json()).toEqual(OPERATOR_NOT_FOUND);
  });

  it('refuses a visitor without a session, and a write without the dashboard header', async () => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, pierre);

    const visitor = await post(ROY_OPERATOR_ID, {});
    const noHeader = await post(ROY_OPERATOR_ID, cookies, {});

    expect([visitor.statusCode, noHeader.statusCode]).toEqual([401, 403]);
  });

  it('refuses an app bearer token: only the dashboard cookie opens these routes', async () => {
    server = startDashboardServer().server;

    const response = await server.inject({ method: 'POST', url: `/v1/dashboard/operators/${ROY_OPERATOR_ID}/stripe-onboarding`, headers: { ...writeHeader, authorization: 'Bearer anything' } });

    expect(response.statusCode).toBe(401);
  });

  it('answers 503 STRIPE_UNAVAILABLE when Stripe cannot be reached', async () => {
    const started = startDashboardServer();
    server = started.server;
    started.gateway.unavailable = true;
    const cookies = await dashboardCookieFor(server, pierre);

    const response = await post(ROY_OPERATOR_ID, cookies);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'STRIPE_UNAVAILABLE' });
  });

  it('answers 503 for Pierre but still 404 for Sophie when the server has no Stripe key', async () => {
    const driverRepository = new FakeDriverRepository([julie, sophie, pierre]);
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ driverRepository }), testClock: composeClock(true).testClock, settings: { testSignInEnabled: true } });

    const own = await post(ROY_OPERATOR_ID, await dashboardCookieFor(server, pierre));
    const other = await post(ROY_OPERATOR_ID, await dashboardCookieFor(server, sophie));

    expect([own.statusCode, other.statusCode]).toEqual([503, 404]);
  });
});

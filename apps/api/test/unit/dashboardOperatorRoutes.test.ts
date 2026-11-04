import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { julie } from './fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import { lavoie, parkingDemo, parkingTestPaliers } from './fakes/fakeOperatorRepository.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };

describe('operator dashboard routes', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function start() {
    server = startDashboardServer().server;
  }

  it('shows Sophie her operator and its two lots', async () => {
    start();
    const cookies = await dashboardCookieFor(server, sophie);

    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });
    const lots = await server.inject({ method: 'GET', url: '/v1/dashboard/lots', cookies });

    expect(me.json()).toEqual({ user: sophie, operator: lavoie });
    expect(lots.json()).toEqual([parkingDemo, parkingTestPaliers]);
  });

  it('lets Nouvel Opérateur create an operator that starts with Stripe not started and no lots', async () => {
    start();
    const cookies = await dashboardCookieFor(server, nouvelOperateur);
    const before = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });

    const created = await server.inject({
      method: 'POST',
      url: '/v1/dashboard/operators',
      cookies,
      headers: writeHeader,
      payload: { legalName: '  Stationnements Exemple inc. ' },
    });
    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });
    const lots = await server.inject({ method: 'GET', url: '/v1/dashboard/lots', cookies });

    expect(before.json<{ operator: unknown }>().operator).toBeNull();
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ legalName: 'Stationnements Exemple inc.', kycStatus: 'NOT_STARTED' });
    expect(me.json<{ operator: unknown }>().operator).toEqual(created.json());
    expect(lots.json()).toEqual([]);
  });

  it.each([
    ['one character after trimming', '  a  '],
    ['121 characters', 'x'.repeat(121)],
  ])('refuses a legal name of %s', async (_case, legalName) => {
    start();
    const cookies = await dashboardCookieFor(server, nouvelOperateur);

    const response = await server.inject({ method: 'POST', url: '/v1/dashboard/operators', cookies, headers: writeHeader, payload: { legalName } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'LEGAL_NAME_INVALID' });
  });

  it('refuses a second operator for Sophie', async () => {
    start();
    const cookies = await dashboardCookieFor(server, sophie);

    const response = await server.inject({ method: 'POST', url: '/v1/dashboard/operators', cookies, headers: writeHeader, payload: { legalName: 'Autre inc.' } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'OPERATOR_EXISTS' });
  });

  it('gives Pierre not found and no data for Parking Démo', async () => {
    start();
    const cookies = await dashboardCookieFor(server, pierre);

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${parkingDemo.id}`, cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(LOT_NOT_FOUND);
  });

  it('gives the same not found for a malformed lot id', async () => {
    start();
    const cookies = await dashboardCookieFor(server, sophie);

    const response = await server.inject({ method: 'GET', url: '/v1/dashboard/lots/abc', cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(LOT_NOT_FOUND);
  });

  it('shows Sophie her own lot', async () => {
    start();
    const cookies = await dashboardCookieFor(server, sophie);

    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${parkingTestPaliers.id}`, cookies });

    expect(response.json()).toEqual(parkingTestPaliers);
  });

  it('asks Julie to create an operator and shows her no operator data', async () => {
    start();
    const cookies = await dashboardCookieFor(server, julie);

    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });
    const lots = await server.inject({ method: 'GET', url: '/v1/dashboard/lots', cookies });
    const lot = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${parkingDemo.id}`, cookies });

    expect(me.json()).toEqual({ user: julie, operator: null });
    expect(lots.statusCode).toBe(409);
    expect(lots.json()).toMatchObject({ error: 'NO_OPERATOR' });
    expect(lot.json()).toEqual(LOT_NOT_FOUND);
  });

  it('does not ask a browser for the minimum app version', async () => {
    server = startDashboardServer({ testSignInEnabled: true, minimumAppVersion: '9.0.0' }).server;
    const cookies = await dashboardCookieFor(server, sophie);

    const response = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });

    expect(response.statusCode).toBe(200);
  });
});

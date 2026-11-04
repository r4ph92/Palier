import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { julie, marc } from './fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { DASHBOARD_COOKIE, dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';

function signInAs(server: FastifyInstance, userId: string, headers: Record<string, string> = writeHeader) {
  return server.inject({ method: 'POST', url: '/v1/dashboard/test/sign-in', headers, payload: { userId } });
}

describe('dashboard test sign-in', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('lists the operator personas first, then the drivers', async () => {
    server = startDashboardServer().server;

    const response = await server.inject({ method: 'GET', url: '/v1/dashboard/test/users' });

    expect(response.json()).toEqual([sophie, pierre, nouvelOperateur, julie, marc]);
  });

  it('sets an HttpOnly, SameSite=Strict, Secure cookie limited to the dashboard for twelve hours', async () => {
    server = startDashboardServer().server;

    const response = await signInAs(server, sophie.id);

    expect(response.json()).toEqual({ user: sophie });
    expect(response.cookies).toEqual([
      expect.objectContaining({ name: DASHBOARD_COOKIE, httpOnly: true, sameSite: 'Strict', path: '/v1/dashboard', secure: true, maxAge: 43200 }),
    ]);
  });

  it('leaves Secure off when the server says cookies travel over plain http', async () => {
    server = startDashboardServer({ testSignInEnabled: true, secureCookies: false }).server;

    const response = await signInAs(server, sophie.id);

    expect(response.cookies[0]?.secure).toBeUndefined();
  });

  it('refuses a sign-in without the dashboard header', async () => {
    server = startDashboardServer().server;

    const response = await signInAs(server, sophie.id, {});

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CSRF_HEADER_MISSING' });
    expect(response.cookies).toEqual([]);
  });

  it('answers 404 for a user who is not on the test list', async () => {
    server = startDashboardServer().server;

    const response = await signInAs(server, '00000000-0000-4000-8000-000000000599');

    expect(response.statusCode).toBe(404);
  });

  it('answers 429 after ten sign-ins from one address', async () => {
    server = startDashboardServer().server;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await signInAs(server, sophie.id);
    }

    expect((await signInAs(server, sophie.id)).statusCode).toBe(429);
  });
});

describe('dashboard sign-out', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('expires the cookie and refuses the session afterwards', async () => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, sophie);

    const signOut = await server.inject({ method: 'POST', url: '/v1/dashboard/sign-out', cookies, headers: writeHeader });
    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });

    expect(signOut.statusCode).toBe(204);
    expect(signOut.cookies).toEqual([expect.objectContaining({ name: DASHBOARD_COOKIE, value: '', maxAge: 0, path: '/v1/dashboard' })]);
    expect(me.statusCode).toBe(401);
    expect(me.json()).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  it('refuses a sign-out without the dashboard header and keeps the session', async () => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, sophie);

    const signOut = await server.inject({ method: 'POST', url: '/v1/dashboard/sign-out', cookies });
    const me = await server.inject({ method: 'GET', url: '/v1/dashboard/me', cookies });

    expect(signOut.statusCode).toBe(403);
    expect(me.statusCode).toBe(200);
  });

  it('refuses creating an operator without the dashboard header', async () => {
    server = startDashboardServer().server;
    const cookies = await dashboardCookieFor(server, nouvelOperateur);

    const response = await server.inject({ method: 'POST', url: '/v1/dashboard/operators', cookies, payload: { legalName: 'Exemple inc.' } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CSRF_HEADER_MISSING' });
  });
});

describe('dashboard test sign-in in a production configuration', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('GET /v1/dashboard/test/users answers not found', async () => {
    server = startDashboardServer({}).server;

    const response = await server.inject({ method: 'GET', url: '/v1/dashboard/test/users' });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['with', writeHeader],
    ['without', {}],
  ])('POST /v1/dashboard/test/sign-in answers not found %s the dashboard header', async (_case, headers) => {
    server = startDashboardServer({}).server;

    const response = await signInAs(server, sophie.id, headers);

    expect(response.statusCode).toBe(404);
    expect(response.cookies).toEqual([]);
  });
});

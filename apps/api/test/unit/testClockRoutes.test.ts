import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeCurrentParkingSessions, JULIE_SESSION_ID, julieAtParkingDemo } from './fakes/fakeCurrentParkingSessions.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';
import { methodOf, TEST_ROUTES, urlOf } from './routeClassification.ts';

const clockUrl = '/v1/test/clock';
const backdateUrl = `/v1/test/sessions/${JULIE_SESSION_ID}/entered-at`;
const nineFifteen = new Date(2026, 10, 4, 21, 17);

describe('test clock', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function startServer() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.parkingSessions.add(julie.id, julieAtParkingDemo(new Date(2026, 10, 4, 20, 0)));
    return configured;
  }

  it('reads the instant it was set to until it is moved again', async () => {
    startServer();

    const set = await server.inject({ method: 'PUT', url: clockUrl, payload: { now: nineFifteen.toISOString() } });
    const read = await server.inject({ method: 'GET', url: clockUrl });

    expect(set.json()).toEqual({ now: nineFifteen.toISOString() });
    expect(read.json()).toEqual({ now: nineFifteen.toISOString() });
  });

  it('goes back to real time when deleted', async () => {
    startServer();
    await server.inject({ method: 'PUT', url: clockUrl, payload: { now: nineFifteen.toISOString() } });

    const response = await server.inject({ method: 'DELETE', url: clockUrl });

    expect(Math.abs(Date.parse(response.json<{ now: string }>().now) - Date.now())).toBeLessThan(5000);
  });

  it.each([
    ['a date without time zone', { now: '2026-11-04T21:17:00' }],
    ['a leap second', { now: '2026-12-31T23:59:60Z' }],
    ['no instant', {}],
  ])('refuses %s with 400', async (_case, payload) => {
    startServer();

    expect((await server.inject({ method: 'PUT', url: clockUrl, payload })).statusCode).toBe(400);
  });
});

describe('backdating a session in a test environment', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieInsideSinceEight() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.parkingSessions.add(julie.id, julieAtParkingDemo(new Date(2026, 10, 4, 20, 0)));
    configured.testClock.setFixed(nineFifteen);
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    return { ...configured, readSession: () => server.inject({ method: 'GET', url: '/v1/me/session', headers }) };
  }

  it('moves the entry so the session shows the time since the new entry', async () => {
    const { readSession } = await julieInsideSinceEight();

    const response = await server.inject({ method: 'PUT', url: backdateUrl, payload: { enteredAt: new Date(2026, 10, 4, 18, 2).toISOString() } });

    expect(response.statusCode).toBe(204);
    expect((await readSession()).json()).toMatchObject({ session: { elapsedMinutes: 195, amountCents: 975 } });
  });

  it('refuses an entry later than the clock with 400 ENTERED_AT_IN_FUTURE', async () => {
    await julieInsideSinceEight();

    const response = await server.inject({ method: 'PUT', url: backdateUrl, payload: { enteredAt: new Date(2026, 10, 4, 21, 18).toISOString() } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'ENTERED_AT_IN_FUTURE' });
  });

  it.each([
    ['year 0001', '0001-01-01T00:00:00Z'],
    ['the second before 1970', '1969-12-31T23:59:59Z'],
  ])('refuses an entry in %s with 400 ENTERED_AT_TOO_EARLY', async (_case, enteredAt) => {
    await julieInsideSinceEight();

    const response = await server.inject({ method: 'PUT', url: backdateUrl, payload: { enteredAt } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'ENTERED_AT_TOO_EARLY' });
  });

  it('accepts an entry at 1970-01-01 exactly', async () => {
    await julieInsideSinceEight();

    const response = await server.inject({ method: 'PUT', url: backdateUrl, payload: { enteredAt: '1970-01-01T00:00:00Z' } });

    expect(response.statusCode).toBe(204);
  });

  it.each([
    ['an unknown session', `/v1/test/sessions/00000000-0000-4000-8000-000000000999/entered-at`],
    ['a cancelled session', backdateUrl],
  ])('answers 404 SESSION_NOT_FOUND for %s', async (_case, url) => {
    const { parkingSessions } = await julieInsideSinceEight();
    parkingSessions.cancel(JULIE_SESSION_ID);

    const response = await server.inject({ method: 'PUT', url, payload: { enteredAt: new Date(2026, 10, 4, 18, 2).toISOString() } });

    expect(response.json()).toMatchObject({ statusCode: 404, error: 'SESSION_NOT_FOUND' });
  });

  it.each([
    ['a session id that is not a uuid', '/v1/test/sessions/julie/entered-at', { enteredAt: '2026-11-04T23:02:00Z' }],
    ['an entry that is not a date-time', backdateUrl, { enteredAt: 'hier' }],
  ])('refuses %s with 400', async (_case, url, payload) => {
    await julieInsideSinceEight();

    expect((await server.inject({ method: 'PUT', url, payload })).statusCode).toBe(400);
  });
});

describe('test clock in production', () => {
  let server: FastifyInstance | undefined;

  afterEach(() => server?.close());

  it.each(TEST_ROUTES)('%s answers 404 even when handed a test clock', async (route) => {
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories(), testClock: createTestClock() });

    const response = await server.inject({ method: methodOf(route) as 'GET', url: urlOf(route), payload: { now: nineFifteen.toISOString() } });

    expect(response.statusCode).toBe(404);
  });

  it('prices the session in real time even when handed a test clock', async () => {
    const parkingSessions = new FakeCurrentParkingSessions();
    const driverRepository = new FakeDriverRepository();
    parkingSessions.add(julie.id, julieAtParkingDemo(new Date(2020, 0, 1, 8, 0)));
    const testClock = createTestClock();
    testClock.setFixed(new Date(2020, 0, 1, 8, 10));
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ driverRepository, parkingSessions }), testClock });
    await acceptNoticeAs(driverRepository, julie);

    const response = await server.inject({ method: 'GET', url: '/v1/me/session', headers: await authorizationFor(driverRepository, julie) });

    expect(response.json()).not.toMatchObject({ session: { amountCents: 300 } });
  });
});

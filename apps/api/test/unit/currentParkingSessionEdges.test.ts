import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { julieAtParkingDemo } from './fakes/fakeCurrentParkingSessions.ts';
import { methodOf, TEST_ROUTES, urlOf } from './routeClassification.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const nineSeventeen = new Date(2026, 10, 4, 21, 17);

describe('GET /v1/me/session edge cases', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function readJulieSession(session: ReturnType<typeof julieAtParkingDemo>, now: Date) {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.parkingSessions.add(julie.id, session);
    configured.testClock.setFixed(now);
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    return server.inject({ method: 'GET', url: '/v1/me/session', headers });
  }

  it('reports a session still waiting for the loop as current, with state CREATED', async () => {
    const response = await readJulieSession({ ...julieAtParkingDemo(enteredAt), state: 'CREATED' }, nineSeventeen);

    expect(response.json()).toMatchObject({ session: { state: 'CREATED', elapsedMinutes: 195, amountCents: 975 } });
  });

  it('prices the session with the pricing kept at entry, not the lot policy of today', async () => {
    const keptAtEntry = { incrementCents: 50, incrementMinutes: 10, dailyCapCents: 2000 };

    const response = await readJulieSession({ ...julieAtParkingDemo(enteredAt), pricing: keptAtEntry }, nineSeventeen);

    expect(response.json()).toMatchObject({ session: { elapsedMinutes: 195, amountCents: 1000, dailyCapCents: 2000 } });
  });

  it('counts whole minutes only: an entry at 18:02:59 read at 21:17:00 is 194 minutes', async () => {
    const response = await readJulieSession(julieAtParkingDemo(new Date(2026, 10, 4, 18, 2, 59)), nineSeventeen);

    expect(response.json()).toMatchObject({ session: { elapsedMinutes: 194, amountCents: 975 } });
  });

  it('bills one increment and zero minutes when the clock reads before the entry', async () => {
    const response = await readJulieSession(julieAtParkingDemo(enteredAt), new Date(2026, 10, 4, 17, 0));

    expect(response.json()).toMatchObject({ session: { elapsedMinutes: 0, amountCents: 75 } });
  });

  it('bills the first day at the cap and one increment for the 25th hour', async () => {
    const response = await readJulieSession(julieAtParkingDemo(enteredAt), new Date(2026, 10, 5, 19, 2));

    expect(response.json()).toMatchObject({ session: { elapsedMinutes: 1500, amountCents: 2800 } });
  });
});

describe('test routes without test sign-in', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it.each(TEST_ROUTES)('%s answers the same 404 body as a route that never existed', async (route) => {
    server = configureServer({ testSignInEnabled: false }).server;
    const url = urlOf(route);

    const response = await server.inject({ method: methodOf(route) as 'GET', url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: `Route ${methodOf(route)}:${url} not found`, error: 'Not Found', statusCode: 404 });
  });
});

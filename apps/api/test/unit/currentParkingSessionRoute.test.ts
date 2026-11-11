import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID, julieAtB3WithPlan, julieAtParkingDemo } from './fakes/fakeCurrentParkingSessions.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);

describe('GET /v1/me/session', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieInsideAt(now: Date) {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.parkingSessions.add(julie.id, julieAtParkingDemo(enteredAt));
    configured.testClock.setFixed(now);
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    return { ...configured, readSession: () => server.inject({ method: 'GET', url: '/v1/me/session', headers }) };
  }

  it('shows Julie her spot, entry time, 3 h 15 elapsed and 9,75 $ so far at 21 h 17', async () => {
    const { readSession } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));

    const response = await readSession();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: {
        sessionId: JULIE_SESSION_ID,
        state: 'ENTRY_CONFIRMED',
        lotName: 'Parking Démo',
        spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
        enteredAt: enteredAt.toISOString(),
        elapsedMinutes: 195,
        amountCents: 975,
        dailyCapCents: 2500,
        beaconMajor: 1,
        exitBeaconFallback: false,
        levelPlan: {
          levelCode: 'P1',
          aisles: [
            { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } },
            { code: 'B', beaconMinor: 2, rectangle: { x: 0, y: 50, width: 100, height: 40 } },
          ],
        },
        question: null,
      },
    });
  });

  it.each([
    { clock: '21 h 18', now: new Date(2026, 10, 4, 21, 18), amountCents: 1050 },
    { clock: '4 h 02 the next day', now: new Date(2026, 10, 5, 4, 2), amountCents: 2500 },
  ])('bills $amountCents cents at $clock', async ({ now, amountCents }) => {
    const { readSession } = await julieInsideAt(now);

    expect((await readSession()).json()).toMatchObject({ session: { amountCents } });
  });

  it('serves the exit beacon fallback when two apps reported it (story #49)', async () => {
    const { readSession, parkingSessions } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    parkingSessions.add(julie.id, { ...julieAtParkingDemo(enteredAt), exitBeaconFallback: true });

    expect((await readSession()).json()).toMatchObject({ session: { exitBeaconFallback: true } });
  });

  it('serves a session presumed parked (story #18)', async () => {
    const { readSession, parkingSessions } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    parkingSessions.add(julie.id, { ...julieAtParkingDemo(enteredAt), state: 'PARKED_PRESUMED' });

    const response = await readSession();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ session: { sessionId: JULIE_SESSION_ID, state: 'PARKED_PRESUMED', spot: { number: 'A-1' } } });
  });

  it('asks Julie where she parked, with the free spots of aisle B, after a walk there (story #21)', async () => {
    const { readSession, parkingSessions } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    const question = { aisleCode: 'B', freeSpotNumbers: ['B-1', 'B-2', 'B-3', 'B-5'] };
    parkingSessions.add(julie.id, { ...julieAtParkingDemo(enteredAt), state: 'PARKED_UNCONFIRMED', question });

    const response = await readSession();

    expect(response.json()).toMatchObject({ session: { state: 'PARKED_UNCONFIRMED', spot: { number: 'A-1' }, question } });
  });

  it('serves the spot Julie answered once she is parked-confirmed (story #21)', async () => {
    const { readSession, parkingSessions } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    parkingSessions.add(julie.id, { ...julieAtB3WithPlan(enteredAt), state: 'PARKED_CONFIRMED' });

    const response = await readSession();

    expect(response.json()).toMatchObject({ session: { state: 'PARKED_CONFIRMED', spot: { number: 'B-3', aisleCode: 'B' }, question: null } });
  });

  it('answers no session to a driver who has none', async () => {
    const { readSession, parkingSessions } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    parkingSessions.cancel(JULIE_SESSION_ID);

    expect((await readSession()).json()).toEqual({ session: null });
  });

  it("never gives Marc Julie's session", async () => {
    const { driverRepository } = await julieInsideAt(new Date(2026, 10, 4, 21, 17));
    await acceptNoticeAs(driverRepository, marc);
    const headers = await authorizationFor(driverRepository, marc);

    const response = await server.inject({ method: 'GET', url: '/v1/me/session', headers });

    expect(response.json()).toEqual({ session: null });
  });
});

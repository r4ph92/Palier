import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID, julieAtParkingDemo } from './fakes/fakeCurrentParkingSessions.ts';

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

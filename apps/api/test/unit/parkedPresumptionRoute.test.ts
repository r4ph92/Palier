import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredWalkingSession } from './fakes/fakeParkedPresumptions.ts';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';

const CONFIRMED_AT = new Date('2026-11-04T18:03:00Z');
const WALKED_AT = '2026-11-04T18:05:00.000Z';
const LATER_WALK = '2026-11-04T18:09:00.000Z';
const UNKNOWN_SESSION_ID = '00000000-0000-4000-8000-0000000009ff';

function julieSession(overrides: Partial<StoredWalkingSession> = {}): StoredWalkingSession {
  return { driverId: julie.id, state: 'ENTRY_CONFIRMED', entryConfirmedAt: CONFIRMED_AT, parkedAt: null, ...overrides };
}

describe('POST /v1/entries/:sessionId/parked', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieInside(session = julieSession()) {
    const configured = configureServer();
    server = configured.server;
    configured.parkedPresumptions.add(JULIE_SESSION_ID, session);
    await acceptNoticeAs(configured.driverRepository, julie);
    await acceptNoticeAs(configured.driverRepository, marc);
    const julieHeaders = await authorizationFor(configured.driverRepository, julie);
    const walk = (detectedAt: unknown, headers: Record<string, string> = julieHeaders, sessionId = JULIE_SESSION_ID) =>
      server.inject({ method: 'POST', url: `/v1/entries/${sessionId}/parked`, headers, payload: { detectedAt } });
    return { ...configured, walk };
  }

  it('presumes Julie parked at A-1 with the walking instant once her entry is confirmed', async () => {
    const { walk, parkedPresumptions } = await julieInside();

    const response = await walk(WALKED_AT);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_PRESUMED', parkedAt: new Date(WALKED_AT) });
  });

  it('changes nothing when the same walking signal arrives again, and keeps the first instant', async () => {
    const { walk, parkedPresumptions } = await julieInside();
    await walk(WALKED_AT);

    const again = await walk(LATER_WALK);

    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });
    expect(parkedPresumptions.writes).toBe(1);
  });

  it('refuses a session still waiting for its entry loop with ENTRY_NOT_CONFIRMED, and changes nothing', async () => {
    const waiting = julieSession({ state: 'CREATED', entryConfirmedAt: null });
    const { walk, parkedPresumptions } = await julieInside(waiting);

    const response = await walk(WALKED_AT);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'ENTRY_NOT_CONFIRMED', message: 'The entry loop has not confirmed this session yet.' });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(waiting);
  });

  it("answers not found to Marc walking for Julie's session, and changes nothing", async () => {
    const { walk, driverRepository, parkedPresumptions } = await julieInside();

    const response = await walk(WALKED_AT, await authorizationFor(driverRepository, marc));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such entry.' });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieSession());
  });

  it('answers Marc not found for Julie\'s session id written in upper case, and changes nothing', async () => {
    const { walk, driverRepository, parkedPresumptions } = await julieInside();

    const response = await walk(WALKED_AT, await authorizationFor(driverRepository, marc), JULIE_SESSION_ID.toUpperCase());

    expect(response.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieSession());
  });

  it("answers the same 404 for another driver's session and an unknown id, so neither can be told apart", async () => {
    const { walk, driverRepository } = await julieInside();

    const otherDriver = await walk(WALKED_AT, await authorizationFor(driverRepository, marc));
    const unknownId = await walk(WALKED_AT, await authorizationFor(driverRepository, julie), UNKNOWN_SESSION_ID);

    expect(otherDriver.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect(unknownId.json()).toEqual(SESSION_NOT_FOUND_BODY);
  });

  it('refuses a driver who has not accepted the privacy notice, and changes nothing', async () => {
    const { walk, driverRepository, parkedPresumptions } = await julieInside();
    await acceptNoticeAs(driverRepository, julie, '2025-01-01');

    const response = await walk(WALKED_AT);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieSession());
  });

  it('refuses a cancelled session with SESSION_CLOSED', async () => {
    const { walk } = await julieInside(julieSession({ state: 'CANCELLED' }));

    const response = await walk(WALKED_AT);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'SESSION_CLOSED' });
  });

  it('answers 400 to a session id that is not a UUID', async () => {
    const { walk, driverRepository } = await julieInside();

    const response = await walk(WALKED_AT, await authorizationFor(driverRepository, julie), 'not-a-uuid');

    expect(response.statusCode).toBe(400);
  });

  it.each([
    ['a missing instant', undefined],
    ['an instant that is not a date', 'hier'],
    ['an instant given as a number', 1_793_000_000_000],
    ['a leap second, which a Date cannot hold', '2026-12-31T23:59:60Z'],
    ['an oversized instant', `2026-11-04T18:05:00.${'0'.repeat(64)}Z`],
  ])('answers 400 to %s, and changes nothing', async (_case, detectedAt) => {
    const { walk, parkedPresumptions } = await julieInside();

    const response = await walk(detectedAt);

    expect(response.statusCode).toBe(400);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieSession());
  });

  it('answers 401 without a driver token', async () => {
    const { walk } = await julieInside();

    expect((await walk(WALKED_AT, {})).statusCode).toBe(401);
  });
});

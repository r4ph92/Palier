import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredWalkingSession } from './fakes/fakeParkedPresumptions.ts';

const MINUTE = 60_000;

function confirmedSession(entryConfirmedAt: Date): StoredWalkingSession {
  return { driverId: julie.id, state: 'ENTRY_CONFIRMED', entryConfirmedAt, parkedAt: null };
}

describe('POST /v1/entries/:sessionId/parked, what the body may hold', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieConfirmed(entryConfirmedAt = new Date(Date.now() - 9 * MINUTE)) {
    const configured = configureServer();
    server = configured.server;
    configured.parkedPresumptions.add(JULIE_SESSION_ID, confirmedSession(entryConfirmedAt));
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    const walk = (payload: unknown) => server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/parked`, headers, payload: payload as object });
    return { ...configured, walk, entryConfirmedAt };
  }

  // Like passageRefusesUnrepresentableClosedAt: a Date holds year 0000, Postgres timestamptz does not.
  it('answers 400 to a detectedAt in year 0000, which Postgres cannot store, and changes nothing', async () => {
    const { walk, parkedPresumptions, entryConfirmedAt } = await julieConfirmed();

    const response = await walk({ detectedAt: '0000-01-01T00:00:00Z' });

    expect(response.statusCode).toBe(400);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(confirmedSession(entryConfirmedAt));
  });

  it('takes nothing but detectedAt from the body: a state, a driver or an instant sent along change nothing else', async () => {
    const { walk, parkedPresumptions } = await julieConfirmed();
    const detectedAt = new Date(Date.now() - MINUTE).toISOString();

    const response = await walk({ detectedAt, state: 'CANCELLED', driverId: marc.id, userId: marc.id, parkedAt: '1999-01-01T00:00:00Z', writes: 999 });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'PARKED_PRESUMED', parkedAt: detectedAt });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ driverId: julie.id, state: 'PARKED_PRESUMED', parkedAt: new Date(detectedAt) });
    expect(parkedPresumptions.writes).toBe(1);
  });

  it.each([
    ['an empty instant', ''],
    ['a blank instant', '   '],
    ['a script tag', '<script>alert(1)</script>'],
    ['an SQL fragment', "2026-11-06T10:00:00Z'); drop table spot;--"],
    ['an instant followed by an emoji', '2026-11-06T10:00:00Z😀'],
    ['a date without a time', '2026-11-06'],
    ['null', null],
  ])('answers 400 to %s, and changes nothing', async (_case, detectedAt) => {
    const { walk, parkedPresumptions, entryConfirmedAt } = await julieConfirmed();

    const response = await walk({ detectedAt });

    expect(response.statusCode).toBe(400);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(confirmedSession(entryConfirmedAt));
  });

  it('answers 400 to an array body, and changes nothing', async () => {
    const { walk, parkedPresumptions, entryConfirmedAt } = await julieConfirmed();

    const response = await walk([new Date().toISOString()]);

    expect(response.statusCode).toBe(400);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(confirmedSession(entryConfirmedAt));
  });
});

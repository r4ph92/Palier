import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredAnsweringSession } from './fakes/fakeParkedAnswers.ts';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';

const UNKNOWN_SPOT_BODY = { statusCode: 409, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' };
const SPOT_TAKEN_BODY = { statusCode: 409, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' };

function julieAsked(): StoredAnsweringSession {
  return { driverId: julie.id, assignedSpotNumber: 'A-1', state: 'PARKED_UNCONFIRMED', confirmedSpotNumber: null, answeredAt: null };
}

describe('POST /v1/entries/:sessionId/spot (story #21)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // A-1 is Julie's assigned spot, occupied-unknown since she walked away in aisle B; B-4 is assigned to Marc.
  async function julieAskedWhereParked(session = julieAsked()) {
    const configured = configureServer();
    server = configured.server;
    const { parkedAnswers } = configured;
    parkedAnswers.add(JULIE_SESSION_ID, session);
    parkedAnswers.setSpot('A-1', { state: 'OCCUPIED_UNKNOWN', needsCheck: true });
    parkedAnswers.setSpot('B-4', { state: 'ASSIGNED', needsCheck: false });
    await acceptNoticeAs(configured.driverRepository, julie);
    await acceptNoticeAs(configured.driverRepository, marc);
    const julieHeaders = await authorizationFor(configured.driverRepository, julie);
    const answer = (spotNumber: unknown, headers: Record<string, string> = julieHeaders) =>
      server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber } });
    return { ...configured, answer };
  }

  it('places Julie in B-3: B-3 occupied, the session parked-confirmed on it with the answer time', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer('B-3');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'PARKED_CONFIRMED', spot: { number: 'B-3', levelCode: 'P1', aisleCode: 'B' } });
    expect(parkedAnswers.spotOf('B-3')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'B-3', answeredAt: expect.any(Date) });
  });

  it('leaves A-1 occupied-unknown and flagged to check once Julie is placed in B-3', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    await answer('B-3');

    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED_UNKNOWN', needsCheck: true });
  });

  it('occupies A-1 again and clears its check flag when Julie answers her assigned spot', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer('A-1');

    expect(response.json()).toMatchObject({ state: 'PARKED_CONFIRMED', spot: { number: 'A-1' } });
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'A-1' });
  });

  it.each([
    ['a number the lot does not have', 'Z-99', UNKNOWN_SPOT_BODY],
    ['a spot of another lot', 'C-1', UNKNOWN_SPOT_BODY],
    ['B-4, already assigned to Marc', 'B-4', SPOT_TAKEN_BODY],
  ])('refuses %s, and changes nothing', async (_case, spotNumber, body) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer(spotNumber);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(body);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toEqual(julieAsked());
    expect(parkedAnswers.writes).toBe(0);
  });

  it('refuses an out-of-service spot with SPOT_OUT_OF_SERVICE', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    parkedAnswers.setSpot('B-5', { state: 'OUT_OF_SERVICE', needsCheck: false });

    const response = await answer('B-5');

    expect(response.json()).toEqual({ statusCode: 409, error: 'SPOT_OUT_OF_SERVICE', message: 'This spot is out of service.' });
  });

  it("answers not found to Marc answering for Julie's session, and changes nothing", async () => {
    const { answer, driverRepository, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer('B-3', await authorizationFor(driverRepository, marc));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toEqual(julieAsked());
    expect(parkedAnswers.spotOf('B-3')).toEqual({ state: 'AVAILABLE', needsCheck: false });
  });

  it.each(['b3', 'B 3', ' b – 3 ', 'B—3'])('places Julie in B-3 when she types « %s »', async (typed) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer(typed);

    expect(response.statusCode).toBe(200);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ confirmedSpotNumber: 'B-3' });
  });

  it('keeps « B-03 » unknown: a zero is part of the painted number', async () => {
    const { answer } = await julieAskedWhereParked();

    expect((await answer('B-03')).json()).toEqual(UNKNOWN_SPOT_BODY);
  });

  // The spot number is free text painted on the ground (docs/02), not bound to the seed's « B-3 » shape.
  it.each(['P1-12', 'B12', 'B-7a'])('places Julie in « %s » when she sends the number exactly as the free list showed it', async (paintedNumber) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    parkedAnswers.setSpot(paintedNumber, { state: 'AVAILABLE', needsCheck: false });

    const response = await answer(paintedNumber);

    expect(response.statusCode).toBe(200);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: paintedNumber });
  });

  // « B12 » and « B1-2 » share the canonical form « B12 »: a typed « b12 » names neither for sure.
  it.each(['b12', 'B-12', 'B 1 2'])('places no car for « %s » beside B12 and B1-2, and changes nothing', async (typed) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    parkedAnswers.setSpot('B1-2', { state: 'AVAILABLE', needsCheck: false });
    parkedAnswers.setSpot('B12', { state: 'AVAILABLE', needsCheck: false });

    const response = await answer(typed);

    expect(response.json()).toEqual(UNKNOWN_SPOT_BODY);
    expect(parkedAnswers.writes).toBe(0);
  });

  it('places Julie in B12 beside B1-2 when she sends « B12 » as painted', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    parkedAnswers.setSpot('B1-2', { state: 'AVAILABLE', needsCheck: false });
    parkedAnswers.setSpot('B12', { state: 'AVAILABLE', needsCheck: false });

    expect((await answer('B12')).statusCode).toBe(200);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ confirmedSpotNumber: 'B12' });
  });

  it('answers the first spot again, and writes nothing, when Julie answers twice', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    await answer('B-3');

    const again = await answer('B-5');

    expect(again.json()).toMatchObject({ state: 'PARKED_CONFIRMED', spot: { number: 'B-3' } });
    expect(parkedAnswers.writes).toBe(1);
  });

  it.each([
    ['a session still waiting for its loop', 'ENTRY_CONFIRMED', 'NOT_ASKED'],
    ['a cancelled session', 'CANCELLED', 'SESSION_CLOSED'],
  ] as const)('refuses %s with %s', async (_case, state, error) => {
    const { answer } = await julieAskedWhereParked({ ...julieAsked(), state });

    const response = await answer('B-3');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error });
  });

  it('answers 503 LOT_BUSY when the lot stays locked', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    parkedAnswers.isLotBusy = true;

    const response = await answer('B-3');

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
  });

  it.each([
    ['an empty number', ''],
    ['a number of spaces only', '   '],
    ['a number past 16 characters', 'B-'.padEnd(17, '3')],
    ['a number given as a number', 3],
    ['no number', undefined],
    ['a NUL character, which Postgres text cannot hold', 'B\u00003'],
    ['a line break', 'B-3\n'],
  ])('answers 400 to %s, and changes nothing', async (_case, spotNumber) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();

    const response = await answer(spotNumber);

    expect(response.statusCode).toBe(400);
    expect(parkedAnswers.answeredNumbers).toEqual([]);
  });

  it('refuses a driver who has not accepted the privacy notice', async () => {
    const { answer, driverRepository } = await julieAskedWhereParked();
    await acceptNoticeAs(driverRepository, julie, '2025-01-01');

    const response = await answer('B-3');

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
  });

  it('answers 401 without a driver token', async () => {
    const { answer } = await julieAskedWhereParked();

    expect((await answer('B-3', {})).statusCode).toBe(401);
  });
});

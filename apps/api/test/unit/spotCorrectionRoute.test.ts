import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredAnsweringSession } from './fakes/fakeParkedAnswers.ts';

const UNKNOWN_SPOT_BODY = { statusCode: 409, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' };
const SPOT_TAKEN_BODY = { statusCode: 409, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' };

function juliePresumedInA1(): StoredAnsweringSession {
  return { driverId: julie.id, assignedSpotNumber: 'A-1', state: 'PARKED_PRESUMED', confirmedSpotNumber: null, answeredAt: null };
}

describe('POST /v1/entries/:sessionId/spot correcting a presumed spot (story #22)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // Julie walked away in aisle A: A-1 is presumed and occupied; B-4 is assigned to Marc.
  async function juliePresumed(session = juliePresumedInA1()) {
    const configured = configureServer();
    server = configured.server;
    const { parkedAnswers } = configured;
    parkedAnswers.add(JULIE_SESSION_ID, session);
    parkedAnswers.setSpot('A-1', { state: 'OCCUPIED', needsCheck: false });
    parkedAnswers.setSpot('B-4', { state: 'ASSIGNED', needsCheck: false });
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    const correct = (spotNumber: string) => server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber } });
    return { parkedAnswers, correct };
  }

  it('moves Julie to A-3: A-3 occupied, A-1 occupied-unknown and flagged to check, the session parked-confirmed on A-3', async () => {
    const { correct, parkedAnswers } = await juliePresumed();

    const response = await correct('A-3');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'PARKED_CONFIRMED', spot: { number: 'A-3', levelCode: 'P1', aisleCode: 'A' } });
    expect(parkedAnswers.spotOf('A-3')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED_UNKNOWN', needsCheck: true });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'A-3', answeredAt: expect.any(Date) });
  });

  it('confirms the presumption, A-1 left occupied, when Julie names A-1 itself', async () => {
    const { correct, parkedAnswers } = await juliePresumed();

    const response = await correct('a1');

    expect(response.json()).toMatchObject({ state: 'PARKED_CONFIRMED', spot: { number: 'A-1' } });
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'A-1' });
  });

  it.each([
    ['a number the lot does not have', 'Z-99', UNKNOWN_SPOT_BODY],
    ['B-4, already assigned to Marc', 'B-4', SPOT_TAKEN_BODY],
  ])('refuses %s with the answer messages of #21, and changes nothing', async (_case, spotNumber, body) => {
    const { correct, parkedAnswers } = await juliePresumed();

    const response = await correct(spotNumber);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(body);
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toEqual(juliePresumedInA1());
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.writes).toBe(0);
  });

  it('refuses a correction of a closed session with SESSION_CLOSED', async () => {
    const { correct, parkedAnswers } = await juliePresumed({ ...juliePresumedInA1(), state: 'CANCELLED' });

    const response = await correct('A-3');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'SESSION_CLOSED' });
    expect(parkedAnswers.writes).toBe(0);
  });

  it('keeps the corrected spot, and writes nothing, when Julie corrects a second time', async () => {
    const { correct, parkedAnswers } = await juliePresumed();
    await correct('A-3');

    const again = await correct('A-4');

    expect(again.json()).toMatchObject({ state: 'PARKED_CONFIRMED', spot: { number: 'A-3' } });
    expect(parkedAnswers.spotOf('A-4')).toEqual({ state: 'AVAILABLE', needsCheck: false });
    expect(parkedAnswers.writes).toBe(1);
  });
});

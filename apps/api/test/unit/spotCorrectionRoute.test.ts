import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { julieSessionIn, julieWithAnsweringSession, SPOT_TAKEN_BODY, UNKNOWN_SPOT_BODY } from './parkedAnswerRig.ts';

const juliePresumedInA1 = () => julieSessionIn('PARKED_PRESUMED');

describe('POST /v1/entries/:sessionId/spot correcting a presumed spot (story #22)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // Julie walked away in aisle A: A-1 is presumed and occupied; B-4 is assigned to Marc.
  async function juliePresumed(session = juliePresumedInA1()) {
    const rig = await julieWithAnsweringSession(session, {
      'A-1': { state: 'OCCUPIED', needsCheck: false },
      'B-4': { state: 'ASSIGNED', needsCheck: false },
    });
    server = rig.server;
    return { parkedAnswers: rig.parkedAnswers, correct: rig.answer };
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

  it('moves Julie to A-3 and leaves A-1 alone when an operator freed A-1 first', async () => {
    const { correct, parkedAnswers } = await juliePresumed();
    parkedAnswers.setSpot('A-1', { state: 'AVAILABLE', needsCheck: false });

    const response = await correct('A-3');

    expect(response.statusCode).toBe(200);
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'AVAILABLE', needsCheck: false });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'A-3' });
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

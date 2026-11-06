import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authorizationFor, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { julieSessionIn, julieWithAnsweringSession, SPOT_TAKEN_BODY } from './parkedAnswerRig.ts';
import type { StoredSpot } from './fakes/fakeParkedAnswers.ts';

const MARC_SESSION_ID = '00000000-0000-4000-8000-000000000952';

// QA #22 round 2: A-1, presumed for Julie, was moved out of OCCUPIED by hand (npm run seed:spot-state).
describe('POST /v1/entries/:sessionId/spot on a presumed spot moved by hand (story #22, QA)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function presumedWithA1(a1: StoredSpot) {
    const rig = await julieWithAnsweringSession(julieSessionIn('PARKED_PRESUMED'), { 'A-1': a1, 'B-1': { state: 'OCCUPIED', needsCheck: false } });
    server = rig.server;
    rig.parkedAnswers.add(MARC_SESSION_ID, { driverId: marc.id, assignedSpotNumber: 'B-1', state: 'PARKED_PRESUMED', confirmedSpotNumber: null, answeredAt: null });
    const marcHeaders = await authorizationFor(rig.driverRepository, marc);
    const marcAnswers = (spotNumber: string) =>
      rig.server.inject({ method: 'POST', url: `/v1/entries/${MARC_SESSION_ID}/spot`, headers: marcHeaders, payload: { spotNumber } });
    return { ...rig, marcAnswers };
  }

  it.each([
    ['occupied-unknown and flagged to check', { state: 'OCCUPIED_UNKNOWN', needsCheck: true }],
    ['set available', { state: 'AVAILABLE', needsCheck: false }],
  ] as const)('occupies A-1 again when Julie names it %s, and Marc naming A-1 next gets SPOT_TAKEN', async (_case, a1) => {
    const { answer, marcAnswers, parkedAnswers } = await presumedWithA1(a1);

    const julieResponse = await answer('A-1');
    const marcResponse = await marcAnswers('A-1');

    expect(julieResponse.json()).toMatchObject({ state: 'PARKED_CONFIRMED', spot: { number: 'A-1' } });
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(marcResponse.statusCode).toBe(409);
    expect(marcResponse.json()).toEqual(SPOT_TAKEN_BODY);
    expect(parkedAnswers.sessionOf(MARC_SESSION_ID)).toMatchObject({ state: 'PARKED_PRESUMED', confirmedSpotNumber: null });
  });

  it('refuses A-1 set out of service with SPOT_OUT_OF_SERVICE, Julie left presumed', async () => {
    const { answer, parkedAnswers } = await presumedWithA1({ state: 'OUT_OF_SERVICE', needsCheck: false });

    const response = await answer('A-1');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'SPOT_OUT_OF_SERVICE' });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_PRESUMED', confirmedSpotNumber: null });
    expect(parkedAnswers.writes).toBe(0);
  });
});

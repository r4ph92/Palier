import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { amelieSessionIn, julieSessionIn, julieWithAnsweringSession, SPOT_NOT_SUITABLE_BODY } from './parkedAnswerRig.ts';

const ASSIGNED_A1_WALKED_AWAY = { 'A-1': { state: 'OCCUPIED_UNKNOWN', needsCheck: true } } as const;
const ASSIGNED_A1_PRESUMED = { 'A-1': { state: 'OCCUPIED', needsCheck: false } } as const;
// Amélie walked away from her accessible B-5 into aisle A: B-5 is answerable by state, but still reserved.
const B5_LEFT_BY_AMELIE = { 'B-5': { state: 'OCCUPIED_UNKNOWN', needsCheck: true } } as const;

describe('attacks on the reserved-spot refusal (QA story #125)', () => {
  let server: FastifyInstance | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function julieIn(state: 'PARKED_UNCONFIRMED' | 'PARKED_PRESUMED', spots: Parameters<typeof julieWithAnsweringSession>[1]) {
    const rig = await julieWithAnsweringSession(julieSessionIn(state), spots);
    server = rig.server;
    return rig;
  }

  it('refuses Julie the accessible B-5 that a walked-away driver left occupied-unknown, and leaves it to check', async () => {
    const { answer, parkedAnswers } = await julieIn('PARKED_UNCONFIRMED', { ...ASSIGNED_A1_WALKED_AWAY, ...B5_LEFT_BY_AMELIE });

    const response = await answer('B-5');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(SPOT_NOT_SUITABLE_BODY);
    expect(parkedAnswers.spotOf('B-5')).toEqual({ state: 'OCCUPIED_UNKNOWN', needsCheck: true });
    expect(parkedAnswers.writes).toBe(0);
  });

  it('refuses Julie a correction of her presumed A-1 to the occupied-unknown accessible B-5, and keeps A-1 occupied', async () => {
    const { answer, parkedAnswers } = await julieIn('PARKED_PRESUMED', { ...ASSIGNED_A1_PRESUMED, ...B5_LEFT_BY_AMELIE });

    const response = await answer('B-5');

    expect(response.json()).toEqual(SPOT_NOT_SUITABLE_BODY);
    expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_PRESUMED', confirmedSpotNumber: null });
    expect(parkedAnswers.writes).toBe(0);
  });

  it.each(['B–5', 'B—5', ' B-5 ', 'B 5'])('refuses Julie the reserved B-5 typed as « %s », which canonical matching resolves to B-5', async (typed) => {
    const { answer, parkedAnswers } = await julieIn('PARKED_UNCONFIRMED', ASSIGNED_A1_WALKED_AWAY);

    const response = await answer(typed);

    expect(response.json()).toEqual(SPOT_NOT_SUITABLE_BODY);
    expect(parkedAnswers.writes).toBe(0);
  });

  it('refuses all five of Julie’s simultaneous B-5 answers and writes nothing', async () => {
    const { answer, parkedAnswers } = await julieIn('PARKED_UNCONFIRMED', ASSIGNED_A1_WALKED_AWAY);

    const responses = await Promise.all(Array.from({ length: 5 }, () => answer('B-5')));

    expect(responses.map((response) => response.json<{ error: string }>().error)).toEqual(Array(5).fill('SPOT_NOT_SUITABLE'));
    expect(parkedAnswers.spotOf('B-5')).toEqual({ state: 'AVAILABLE', needsCheck: false });
    expect(parkedAnswers.writes).toBe(0);
  });

  it('lets Amélie correct her presumed B-1 to the electric A-5, and flags B-1 to check', async () => {
    const rig = await julieWithAnsweringSession(amelieSessionIn('PARKED_PRESUMED', 'B-1'), { 'B-1': { state: 'OCCUPIED', needsCheck: false } });
    server = rig.server;

    const response = await rig.answer('A-5', rig.amelieHeaders);

    expect(response.statusCode).toBe(200);
    expect(rig.parkedAnswers.spotOf('A-5')).toEqual({ state: 'OCCUPIED', needsCheck: false });
    expect(rig.parkedAnswers.spotOf('B-1')).toEqual({ state: 'OCCUPIED_UNKNOWN', needsCheck: true });
  });
});

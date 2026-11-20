import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { julieSessionIn, julieWithAnsweringSession, SPOT_NOT_SUITABLE_BODY } from './parkedAnswerRig.ts';
import { PARKED_ANSWER_LIMIT, PARKED_ATTEMPT_WINDOW_MILLISECONDS, PARKED_SIGNAL_LIMIT } from '../../src/domain/parkingSessions/parkedAttemptLimits.ts';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';

const TOO_MANY_ANSWERS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_ANSWERS', message: 'Too many attempts. Try again in a few minutes.' };
const TOO_MANY_SIGNALS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_SIGNALS', message: 'Too many attempts. Try again in a few minutes.' };

describe('Limits on parked answers and walking signals (story #126)', () => {
  let server: FastifyInstance;

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));

  afterEach(async () => {
    vi.useRealTimers();
    await server.close();
  });

  async function julieAskedWhereParked() {
    const rig = await julieWithAnsweringSession(julieSessionIn('PARKED_UNCONFIRMED'), { 'A-1': { state: 'OCCUPIED_UNKNOWN', needsCheck: true } });
    server = rig.server;
    return rig;
  }

  async function answerTimes(answer: (spotNumber: string) => Promise<unknown>, count: number): Promise<void> {
    for (let attempt = 0; attempt < count; attempt += 1) {
      await answer('Z-99');
    }
  }

  describe('answers', () => {
    it('refuses the 11th answer with 429 and the stable code, and leaves B-3 free and the question shown', async () => {
      const { answer, parkedAnswers } = await julieAskedWhereParked();
      await answerTimes(answer, PARKED_ANSWER_LIMIT);
      const answeredBefore = parkedAnswers.answeredNumbers.length;

      const response = await answer('B-3');

      expect(response.statusCode).toBe(429);
      expect(response.json()).toEqual(TOO_MANY_ANSWERS_BODY);
      expect(parkedAnswers.answeredNumbers).toHaveLength(answeredBefore);
      expect(parkedAnswers.spotOf('B-3')).toEqual({ state: 'AVAILABLE', needsCheck: false });
      expect(parkedAnswers.spotOf('A-1')).toEqual({ state: 'OCCUPIED_UNKNOWN', needsCheck: true });
      expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_UNCONFIRMED' });
    });

    it('counts reserved-spot refusals, then answers B-5 and B-3 with the same 429 body', async () => {
      const { answer, parkedAnswers } = await julieAskedWhereParked();
      for (let attempt = 0; attempt < PARKED_ANSWER_LIMIT; attempt += 1) {
        const refused = await answer('B-5');
        expect([refused.statusCode, refused.json()]).toEqual([409, SPOT_NOT_SUITABLE_BODY]);
      }

      const reserved = await answer('B-5');
      const free = await answer('B-3');

      expect([reserved.statusCode, reserved.json()]).toEqual([429, TOO_MANY_ANSWERS_BODY]);
      expect([free.statusCode, free.json()]).toEqual([429, TOO_MANY_ANSWERS_BODY]);
      expect(parkedAnswers.answeredNumbers).toHaveLength(PARKED_ANSWER_LIMIT);
    });

    it('accepts the answer again once 10 minutes have passed since the 10th', async () => {
      const { answer } = await julieAskedWhereParked();
      await answerTimes(answer, PARKED_ANSWER_LIMIT);

      vi.setSystemTime(Date.now() + PARKED_ATTEMPT_WINDOW_MILLISECONDS);
      const response = await answer('B-3');

      expect(response.statusCode).toBe(200);
    });

    it("accepts Marc's answer while Julie is limited: each driver counts on their own", async () => {
      const { answer, driverRepository, parkedAnswers } = await julieAskedWhereParked();
      parkedAnswers.add('00000000-0000-4000-8000-0000000000aa', { ...julieSessionIn('PARKED_UNCONFIRMED'), driverId: marc.id });
      await answerTimes(answer, PARKED_ANSWER_LIMIT);

      const response = await server.inject({
        method: 'POST',
        url: '/v1/entries/00000000-0000-4000-8000-0000000000aa/spot',
        headers: await authorizationFor(driverRepository, marc),
        payload: { spotNumber: 'B-3' },
      });

      expect(response.statusCode).toBe(200);
    });

    it("counts Marc's answers for Julie's session against Marc: they stay 404, then 429 for him only", async () => {
      const { answer, driverRepository } = await julieAskedWhereParked();
      const marcHeaders = await authorizationFor(driverRepository, marc);

      const first = await answer('B-3', marcHeaders);
      await answerTimes((spotNumber) => answer(spotNumber, marcHeaders), PARKED_ANSWER_LIMIT - 1);
      const limited = await answer('B-3', marcHeaders);
      const julieAnswer = await answer('B-3');

      expect(first.json()).toEqual(SESSION_NOT_FOUND_BODY);
      expect(limited.json()).toEqual(TOO_MANY_ANSWERS_BODY);
      expect(julieAnswer.statusCode).toBe(200);
    });

    it('refuses no request in Julie’s ordinary flow: one mistyped number, then the right one', async () => {
      const { answer } = await julieAskedWhereParked();

      const mistyped = await answer('Z-99');
      const right = await answer('B-3');

      expect([mistyped.statusCode, right.statusCode]).toEqual([409, 200]);
    });
  });

  describe('walking signals', () => {
    async function julieInside() {
      const configured = configureServer();
      server = configured.server;
      configured.parkedPresumptions.add(JULIE_SESSION_ID, { driverId: julie.id, state: 'ENTRY_CONFIRMED', entryConfirmedAt: new Date(), parkedAt: null });
      await acceptNoticeAs(configured.driverRepository, julie);
      const headers = await authorizationFor(configured.driverRepository, julie);
      const walk = () =>
        server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/parked`, headers, payload: { detectedAt: new Date().toISOString() } });
      return { ...configured, walk };
    }

    it('refuses the 21st signal with 429 and the stable code, and leaves the session as the 20th left it', async () => {
      const { walk, parkedPresumptions } = await julieInside();
      for (let signal = 0; signal < PARKED_SIGNAL_LIMIT; signal += 1) {
        expect((await walk()).statusCode).toBe(200);
      }
      const afterTwentieth = parkedPresumptions.sessionOf(JULIE_SESSION_ID);

      const response = await walk();

      expect(response.statusCode).toBe(429);
      expect(response.json()).toEqual(TOO_MANY_SIGNALS_BODY);
      expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(afterTwentieth);
    });
  });

  it('does not refuse a walking signal for Julie once her answers are limited: the two routes count on their own', async () => {
    const { answer, driverRepository } = await julieAskedWhereParked();
    await answerTimes(answer, PARKED_ANSWER_LIMIT);
    expect((await answer('B-3')).statusCode).toBe(429);

    const signal = await server.inject({
      method: 'POST',
      url: `/v1/entries/${JULIE_SESSION_ID}/parked`,
      headers: await authorizationFor(driverRepository, julie),
      payload: { detectedAt: new Date().toISOString() },
    });

    expect(signal.statusCode).not.toBe(429);
  });
});

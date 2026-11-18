import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { PARKED_ANSWER_LIMIT, PARKED_ATTEMPT_WINDOW_MILLISECONDS, PARKED_SIGNAL_LIMIT } from '../../src/domain/parkingSessions/parkedAttemptLimits.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { ACCEPTED_DEMO_TARIFF, ENTREE_DEMO_SECRET, entreeDemoGate } from './fakes/entryFakes.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { readyDriver } from './fakes/readyDriver.ts';
import { julieSessionIn, julieWithAnsweringSession } from './parkedAnswerRig.ts';

const TOO_MANY_ANSWERS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_ANSWERS', message: 'Too many attempts. Try again in a few minutes.' };
const TOO_MANY_SIGNALS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_SIGNALS', message: 'Too many attempts. Try again in a few minutes.' };
const LOT_SPOTS = {
  'A-1': { state: 'OCCUPIED_UNKNOWN', needsCheck: true },
  'A-2': { state: 'OCCUPIED', needsCheck: false },
  'B-4': { state: 'OUT_OF_SERVICE', needsCheck: false },
} as const;

describe('Limits on parked answers and walking signals, attacked (story #126 QA)', () => {
  let server: FastifyInstance;

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));

  afterEach(async () => {
    vi.useRealTimers();
    await server.close();
  });

  async function julieAskedWhereParked() {
    const rig = await julieWithAnsweringSession(julieSessionIn('PARKED_UNCONFIRMED'), LOT_SPOTS);
    server = rig.server;
    return rig;
  }

  async function answerTimes(answer: (spotNumber: string) => Promise<unknown>, count: number): Promise<void> {
    for (let attempt = 0; attempt < count; attempt += 1) {
      await answer('Z-99');
    }
  }

  it.each(['B-3', 'A-2', 'B-4', 'B-5', 'Z-99', 'A-1'])('answers %s past the limit with the same 429 body whatever the spot is, and never reaches the lot', async (spotNumber) => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    await answerTimes(answer, PARKED_ANSWER_LIMIT);
    const writesBefore = parkedAnswers.writes;

    const response = await answer(spotNumber);

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual(TOO_MANY_ANSWERS_BODY);
    expect(parkedAnswers.answeredNumbers).toHaveLength(PARKED_ANSWER_LIMIT);
    expect(parkedAnswers.writes).toBe(writesBefore);
  });

  it('still refuses one millisecond before the window ends, and accepts B-3 at its end', async () => {
    const { answer, parkedAnswers } = await julieAskedWhereParked();
    const firstAnswerAt = Date.now();
    await answerTimes(answer, PARKED_ANSWER_LIMIT);

    vi.setSystemTime(firstAnswerAt + PARKED_ATTEMPT_WINDOW_MILLISECONDS - 1);
    const early = await answer('B-3');
    vi.setSystemTime(firstAnswerAt + PARKED_ATTEMPT_WINDOW_MILLISECONDS);
    const onTime = await answer('B-3');

    expect(early.statusCode).toBe(429);
    expect(onTime.json()).toEqual({ state: 'PARKED_CONFIRMED', spot: expect.objectContaining({ number: 'B-3' }) });
    expect(parkedAnswers.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_CONFIRMED', confirmedSpotNumber: 'B-3' });
  });

  it('does not let refused answers push the window back: hammering while limited still frees Julie 10 minutes after her first answer', async () => {
    const { answer } = await julieAskedWhereParked();
    const firstAnswerAt = Date.now();
    await answerTimes(answer, PARKED_ANSWER_LIMIT);
    vi.setSystemTime(firstAnswerAt + PARKED_ATTEMPT_WINDOW_MILLISECONDS / 2);
    await answerTimes(answer, 50);

    vi.setSystemTime(firstAnswerAt + PARKED_ATTEMPT_WINDOW_MILLISECONDS);

    expect((await answer('B-3')).statusCode).toBe(200);
  });

  it('counts a blank answer, which passes the schema, like any other', async () => {
    const { answer } = await julieAskedWhereParked();
    for (let attempt = 0; attempt < PARKED_ANSWER_LIMIT; attempt += 1) {
      expect((await answer('   ')).statusCode).toBe(400);
    }

    expect((await answer('B-3')).json()).toEqual(TOO_MANY_ANSWERS_BODY);
  });

  it('does not count schema-invalid or unauthenticated answers: Julie still has her 10 answers', async () => {
    const { answer } = await julieAskedWhereParked();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await answer(12);
      await answer('X'.repeat(17));
    }
    await answer('B-3', {});

    await answerTimes(answer, PARKED_ANSWER_LIMIT - 1);

    expect((await answer('B-3')).statusCode).toBe(200);
  });

  it('follows the driver, not the token: a fresh sign-in does not reset Julie’s answers', async () => {
    const { answer, driverRepository } = await julieAskedWhereParked();
    await answerTimes(answer, PARKED_ANSWER_LIMIT);

    const freshHeaders = await authorizationFor(driverRepository, julie, 'Julie-second-device-token');

    expect((await answer('B-3', freshHeaders)).json()).toEqual(TOO_MANY_ANSWERS_BODY);
  });

  it('refuses exactly the answers past the limit when they all arrive at once', async () => {
    const { answer } = await julieAskedWhereParked();

    const responses = await Promise.all(Array.from({ length: 30 }, () => answer('Z-99')));

    expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(30 - PARKED_ANSWER_LIMIT);
  });

  describe('walking signals', () => {
    async function julieAndMarcInside() {
      const configured = configureServer();
      server = configured.server;
      configured.parkedPresumptions.add(JULIE_SESSION_ID, { driverId: julie.id, state: 'ENTRY_CONFIRMED', entryConfirmedAt: new Date(), parkedAt: null });
      await acceptNoticeAs(configured.driverRepository, julie);
      await acceptNoticeAs(configured.driverRepository, marc);
      const julieHeaders = await authorizationFor(configured.driverRepository, julie);
      const marcHeaders = await authorizationFor(configured.driverRepository, marc);
      const walk = (headers: Record<string, string>, sessionId = JULIE_SESSION_ID) =>
        server.inject({ method: 'POST', url: `/v1/entries/${sessionId}/parked`, headers, payload: { detectedAt: new Date().toISOString(), detectedAisleMinor: 2 } });
      return { ...configured, walk, julieHeaders, marcHeaders };
    }

    it("counts Marc's walk signals on Julie's session against Marc: 404 then 429 for him, while Julie's own signal is recorded", async () => {
      const { walk, julieHeaders, marcHeaders, parkedPresumptions } = await julieAndMarcInside();
      const marcProbes = [];
      for (let signal = 0; signal < PARKED_SIGNAL_LIMIT; signal += 1) {
        marcProbes.push((await walk(marcHeaders)).statusCode);
      }

      const marcLimited = await walk(marcHeaders);
      const julieOwn = await walk(julieHeaders);

      expect(new Set(marcProbes)).toEqual(new Set([404]));
      expect(marcLimited.json()).toEqual(TOO_MANY_SIGNALS_BODY);
      expect(julieOwn.statusCode).toBe(200);
      expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_UNCONFIRMED' });
    });

    it('counts per driver across sessions: 20 signals on unknown session ids limit the 21st on her real session', async () => {
      const { walk, julieHeaders, parkedPresumptions } = await julieAndMarcInside();
      for (let signal = 0; signal < PARKED_SIGNAL_LIMIT; signal += 1) {
        await walk(julieHeaders, `00000000-0000-4000-8000-${String(signal).padStart(12, '0')}`);
      }

      const response = await walk(julieHeaders);

      expect(response.json()).toEqual(TOO_MANY_SIGNALS_BODY);
      expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'ENTRY_CONFIRMED', parkedAt: null });
    });

    it('still accepts Julie’s answers once her walk signals are limited', async () => {
      const { answer, driverRepository } = await julieAskedWhereParked();
      const headers = await authorizationFor(driverRepository, julie);
      const walk = () => server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/parked`, headers, payload: { detectedAt: new Date().toISOString() } });
      for (let signal = 0; signal < PARKED_SIGNAL_LIMIT; signal += 1) {
        await walk();
      }
      expect((await walk()).json()).toEqual(TOO_MANY_SIGNALS_BODY);

      expect((await answer('B-3')).statusCode).toBe(200);
    });
  });

  it('leaves the entry limit untouched once both parked limits are reached', async () => {
    const configured = configureServer();
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    for (let attempt = 0; attempt <= PARKED_SIGNAL_LIMIT; attempt += 1) {
      await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/parked`, headers, payload: { detectedAt: new Date().toISOString() } });
      await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber: 'Z-99' } });
    }
    const answerLimited = await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber: 'B-3' } });

    const entry = await server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET), tariff: ACCEPTED_DEMO_TARIFF } });

    expect(answerLimited.statusCode).toBe(429);
    expect(entry.statusCode).toBe(201);
  });
});

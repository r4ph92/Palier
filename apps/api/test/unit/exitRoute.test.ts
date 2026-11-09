import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { EXIT_GATE_ID, EXIT_SESSION_ID, julieInside } from './fakes/fakeExits.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const at2117 = new Date(2026, 10, 4, 21, 17);

describe('POST /v1/entries/:sessionId/exit', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieAtTheExit() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.exits.add(julie.id, julieInside(enteredAt));
    configured.testClock.setFixed(at2117);
    await acceptNoticeAs(configured.driverRepository, julie);
    await acceptNoticeAs(configured.driverRepository, marc);
    const julieHeaders = await authorizationFor(configured.driverRepository, julie);
    const marcHeaders = await authorizationFor(configured.driverRepository, marc);
    const tap = (headers: Record<string, string> = julieHeaders, sessionId = EXIT_SESSION_ID) =>
      server.inject({ method: 'POST', url: `/v1/entries/${sessionId}/exit`, headers });
    return { ...configured, tap, marcHeaders };
  }

  it('captures 9,75 $, orders the exit gate open and answers the 3 h 15 receipt', async () => {
    const { tap, entries, exits } = await julieAtTheExit();

    const response = await tap();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      receipt: { exitedAt: at2117.toISOString(), durationMinutes: 195, increments: 13, incrementCents: 75, totalCents: 975, capped: false },
    });
    expect(entries.payments.captured).toEqual([{ sessionId: EXIT_SESSION_ID, paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(exits.closings).toMatchObject([{ sessionId: EXIT_SESSION_ID, exitGateId: EXIT_GATE_ID, exit: { exitedAt: at2117, capturedCents: 975 } }]);
  });

  it('captures once and answers the same receipt when Julie taps twice', async () => {
    const { tap, entries, testClock } = await julieAtTheExit();

    const first = await tap();
    testClock.setFixed(new Date(2026, 10, 4, 21, 20));
    const second = await tap();

    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(entries.payments.captured).toHaveLength(1);
  });

  it('answers not found to Marc and captures nothing', async () => {
    const { tap, marcHeaders, entries, exits } = await julieAtTheExit();

    const response = await tap(marcHeaders);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('answers 503 PAYMENTS_UNAVAILABLE and leaves the session open when Stripe cannot capture', async () => {
    const { tap, entries, exits } = await julieAtTheExit();
    entries.payments.captureOutcome = 'failed';

    const response = await tap();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'PAYMENTS_UNAVAILABLE' });
    expect(exits.closings).toEqual([]);
  });

  it('refuses a session id that is not a UUID', async () => {
    const { tap } = await julieAtTheExit();

    expect((await tap(undefined, 'not-a-uuid')).statusCode).toBe(400);
  });

  it('refuses an exit without a signed-in driver', async () => {
    const { tap } = await julieAtTheExit();

    expect((await tap({})).statusCode).toBe(401);
  });
});

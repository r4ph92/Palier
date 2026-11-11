import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { EXIT_SESSION_ID, julieInside } from './fakes/fakeExits.ts';
import { ENTREE_DEMO_KEY, entreeDemo, REVOKED_KEY, SORTIE_DEMO_KEY, sortieDemo, UNKNOWN_KEY } from './fakes/gateFixtures.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const MARC_SESSION_ID = '00000000-0000-4000-8000-0000000000bb';
const at2117 = new Date(2026, 10, 4, 21, 17);

describe('exit by beacon over HTTP', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieAndMarcParked() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    const parked = { ...julieInside(enteredAt), lotId: sortieDemo.lotId, exitGateId: sortieDemo.id };
    configured.exits.add(julie.id, parked);
    configured.exits.add(marc.id, { ...parked, id: MARC_SESSION_ID, paymentIntentId: 'pi_marc' });
    configured.testClock.setFixed(at2117);
    await acceptNoticeAs(configured.driverRepository, julie);
    await acceptNoticeAs(configured.driverRepository, marc);
    const julieHeaders = await authorizationFor(configured.driverRepository, julie);
    const marcHeaders = await authorizationFor(configured.driverRepository, marc);
    const report = (body: unknown = { major: 1 }, headers: Record<string, string> = julieHeaders, sessionId = EXIT_SESSION_ID) =>
      server.inject({ method: 'POST', url: `/v1/entries/${sessionId}/exit-beacon`, headers, payload: body as object });
    const vehicle = (deviceKey = SORTIE_DEMO_KEY, gateId = sortieDemo.id) =>
      server.inject({ method: 'POST', url: `/v1/gates/${gateId}/presence`, headers: { authorization: `Bearer ${deviceKey}` } });
    return { ...configured, report, vehicle, julieHeaders, marcHeaders };
  }

  it('captures, opens and answers "opened" when Julie reports the beacon and the vehicle is at the gate', async () => {
    const { report, vehicle, entries, exits } = await julieAndMarcParked();

    expect((await report()).statusCode).toBe(204);
    const arrived = await vehicle();

    expect(arrived.statusCode).toBe(200);
    expect(arrived.json()).toEqual({ outcome: 'opened' });
    expect(entries.payments.captured).toMatchObject([{ paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(exits.closings).toMatchObject([{ identification: 'BEACON', exitGateId: sortieDemo.id }]);
  });

  it('gives the same result when the vehicle comes first', async () => {
    const { report, vehicle, exits } = await julieAndMarcParked();

    expect((await vehicle()).json()).toEqual({ outcome: 'waiting' });
    expect((await report()).statusCode).toBe(204);

    expect(exits.closings).toMatchObject([{ identification: 'BEACON' }]);
  });

  it('answers "fallback" and takes nothing when Julie and Marc both reported', async () => {
    const { report, vehicle, marcHeaders, entries, exits } = await julieAndMarcParked();

    await report();
    await report({ major: 1 }, marcHeaders, MARC_SESSION_ID);
    const arrived = await vehicle();

    expect(arrived.json()).toEqual({ outcome: 'fallback' });
    expect(entries.payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('answers not found when Marc reports the beacon for Julie, and changes nothing', async () => {
    const { report, vehicle, marcHeaders, exits } = await julieAndMarcParked();

    const response = await report({ major: 1 }, marcHeaders);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect((await vehicle()).json()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toEqual([]);
  });

  it('answers not found for an unknown session', async () => {
    const { report } = await julieAndMarcParked();

    expect((await report({ major: 1 }, undefined, '00000000-0000-4000-8000-0000000000aa')).statusCode).toBe(404);
  });

  it('refuses the beacon of another parking with BEACON_NOT_THIS_LOT and records nothing', async () => {
    const { report, vehicle, exits } = await julieAndMarcParked();

    const response = await report({ major: 2 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'BEACON_NOT_THIS_LOT' });
    expect((await vehicle()).json()).toEqual({ outcome: 'waiting' });
    expect(exits.closings).toEqual([]);
  });

  it('refuses a report without a session token', async () => {
    const { report } = await julieAndMarcParked();

    expect((await report({ major: 1 }, {})).statusCode).toBe(401);
  });

  it.each([{}, { major: -1 }, { major: 1.5 }, { major: '1' }, { major: 70000 }, null])('refuses the malformed body %j', async (body) => {
    const { report, exits } = await julieAndMarcParked();

    expect((await report(body)).statusCode).toBe(400);
    expect(exits.closings).toEqual([]);
  });

  it('refuses a replayed report once the session has left, and never captures twice', async () => {
    const { report, vehicle, entries } = await julieAndMarcParked();
    await report();
    await vehicle();

    const replay = await report();

    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ error: 'SESSION_CLOSED' });
    expect((await vehicle()).json()).toEqual({ outcome: 'waiting' });
    expect(entries.payments.captured).toHaveLength(1);
  });

  describe('the console presence', () => {
    it('refuses a missing, unknown or revoked device key', async () => {
      const { vehicle, server: serverUnderTest } = await julieAndMarcParked();

      expect((await vehicle(UNKNOWN_KEY)).statusCode).toBe(401);
      expect((await vehicle(REVOKED_KEY)).statusCode).toBe(401);
      expect((await serverUnderTest.inject({ method: 'POST', url: `/v1/gates/${sortieDemo.id}/presence` })).statusCode).toBe(401);
    });

    it("refuses the key of another gate for this gate's path", async () => {
      const { vehicle } = await julieAndMarcParked();

      const response = await vehicle(ENTREE_DEMO_KEY, sortieDemo.id);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'GATE_FORBIDDEN' });
    });

    it('refuses an entry gate, which has no arming loop for an exit', async () => {
      const { vehicle, report, exits } = await julieAndMarcParked();
      await report();

      const response = await vehicle(ENTREE_DEMO_KEY, entreeDemo.id);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'GATE_NOT_EXIT' });
      expect(exits.closings).toEqual([]);
    });
  });
});

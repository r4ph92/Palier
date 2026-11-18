import type { EntrySessionState } from '@palier/shared-types';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredReportSpot } from './fakes/fakeSpotTakenReports.ts';

const OCCUPIED: StoredReportSpot = { state: 'OCCUPIED', needsCheck: false };
const FLAGGED: StoredReportSpot = { state: 'OCCUPIED_UNKNOWN', needsCheck: true };

function julieSessionIn(state: EntrySessionState) {
  return { driverId: julie.id, state, assignedSpotNumber: 'A-1', parkedAisleCode: null };
}

describe('POST /v1/entries/:sessionId/spot-taken (story #23)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // Julie went through the gate on A-1, occupied by the loop; Parking Démo's other spots are free unless a case takes them.
  async function julieThroughTheGate(state: EntrySessionState = 'ENTRY_CONFIRMED') {
    const configured = configureServer();
    server = configured.server;
    const { spotTakenReports, driverRepository } = configured;
    spotTakenReports.add(JULIE_SESSION_ID, julieSessionIn(state));
    spotTakenReports.setSpot('A-1', OCCUPIED);
    await acceptNoticeAs(driverRepository, julie);
    await acceptNoticeAs(driverRepository, marc);
    const julieHeaders = await authorizationFor(driverRepository, julie);
    const report = (spotNumber: unknown, headers: Record<string, string> = julieHeaders) =>
      server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot-taken`, headers, payload: { spotNumber } });
    return { ...configured, report };
  }

  it('gives Julie A-2 in the same aisle and flags A-1 occupied-unknown to check', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();

    const response = await report('A-1');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: 'reassigned', spot: { number: 'A-2', levelCode: 'P1', aisleCode: 'A' } });
    expect(spotTakenReports.spotOf('A-1')).toEqual(FLAGGED);
    expect(spotTakenReports.spotOf('A-2')).toEqual(OCCUPIED);
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'ENTRY_CONFIRMED', assignedSpotNumber: 'A-2', reportedSpotNumbers: ['A-1'] });
  });

  it('gives Julie the aisle-B spot the allocation rules choose when aisle A has no other fitting free spot', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();
    ['A-2', 'A-3', 'A-4'].forEach((number) => spotTakenReports.setSpot(number, OCCUPIED));
    spotTakenReports.setSpot('A-5', { state: 'AVAILABLE', needsCheck: false, isEv: true });

    const response = await report('A-1');

    expect(response.json()).toEqual({ outcome: 'reassigned', spot: { number: 'B-1', levelCode: 'P1', aisleCode: 'B' } });
  });

  it('flags A-1 and asks Julie where she parked, in aisle A, when no fitting spot is left in the lot', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();
    ['A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'].forEach((number) => spotTakenReports.setSpot(number, OCCUPIED));

    const response = await report('A-1');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: 'none-free' });
    expect(spotTakenReports.spotOf('A-1')).toEqual(FLAGGED);
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_UNCONFIRMED', parkedAisleCode: 'A', assignedSpotNumber: 'A-1' });
  });

  it.each(['PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'] as const)('refuses a session %s with ALREADY_PARKED, and changes nothing', async (state) => {
    const { report, spotTakenReports } = await julieThroughTheGate(state);

    const response = await report('A-1');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ statusCode: 409, error: 'ALREADY_PARKED', message: 'This session is already parked.' });
    expect(spotTakenReports.writes).toBe(0);
  });

  it.each([
    ['a session still waiting for its loop', 'CREATED', 'ENTRY_NOT_CONFIRMED'],
    ['a cancelled session', 'CANCELLED', 'SESSION_CLOSED'],
  ] as const)('refuses %s with %s', async (_case, state, error) => {
    const { report } = await julieThroughTheGate(state);

    const response = await report('A-1');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error });
  });

  it("answers not found to Marc reporting Julie's spot taken, and changes nothing", async () => {
    const { report, driverRepository, spotTakenReports } = await julieThroughTheGate();

    const response = await report('A-1', await authorizationFor(driverRepository, marc));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(SESSION_NOT_FOUND_BODY);
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ assignedSpotNumber: 'A-1', reportedSpotNumbers: [] });
    expect(spotTakenReports.spotOf('A-1')).toEqual(OCCUPIED);
  });

  it('refuses a second report of A-1 once Julie is on A-2 with SPOT_NOT_ASSIGNED, and keeps A-2', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();
    await report('A-1');

    const again = await report('A-1');

    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ statusCode: 409, error: 'SPOT_NOT_ASSIGNED', message: 'This spot is not the one assigned to this session.' });
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ assignedSpotNumber: 'A-2' });
    expect(spotTakenReports.writes).toBe(1);
  });

  describe('the cap of three accepted reports per session (story #129)', () => {
    const LIMIT_BODY = { statusCode: 409, error: 'SPOT_REPORT_LIMIT', message: 'You have reached the report limit for this session.' };

    async function julieAfterReports(count: number) {
      const configured = await julieThroughTheGate();
      let assigned = 'A-1';
      for (let made = 0; made < count; made += 1) {
        const response = await configured.report(assigned);
        assigned = (response.json() as { spot: { number: string } }).spot.number;
      }
      return { ...configured, assigned };
    }

    it('accepts her third report after two, as today', async () => {
      const { report, assigned, spotTakenReports } = await julieAfterReports(2);

      const response = await report(assigned);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ outcome: 'reassigned' });
      expect(spotTakenReports.spotOf(assigned)).toEqual(FLAGGED);
    });

    it('refuses her fourth with SPOT_REPORT_LIMIT, leaving the spot unflagged, her assignment and the writes unchanged', async () => {
      const { report, assigned, spotTakenReports } = await julieAfterReports(3);
      const writes = spotTakenReports.writes;

      const response = await report(assigned);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual(LIMIT_BODY);
      expect(spotTakenReports.spotOf(assigned)).toEqual(OCCUPIED);
      expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'ENTRY_CONFIRMED', assignedSpotNumber: assigned });
      expect(spotTakenReports.writes).toBe(writes);
    });

    it('keeps refusing her, never counting the refusals as reports', async () => {
      const { report, assigned, spotTakenReports } = await julieAfterReports(3);

      await report(assigned);
      const again = await report(assigned);

      expect(again.json()).toEqual(LIMIT_BODY);
      expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)?.reportedSpotNumbers).toHaveLength(3);
    });

    it('counts per session: a new session of Julie starts again at zero', async () => {
      const { report, spotTakenReports, driverRepository } = await julieAfterReports(3);
      const newSession = '00000000-0000-4000-8000-000000000952';
      spotTakenReports.add(newSession, julieSessionIn('ENTRY_CONFIRMED'));
      spotTakenReports.setSpot('A-1', OCCUPIED);

      const response = await server.inject({ method: 'POST', url: `/v1/entries/${newSession}/spot-taken`, headers: await authorizationFor(driverRepository, julie), payload: { spotNumber: 'A-1' } });

      expect(response.statusCode).toBe(200);
      expect((await report('A-1')).statusCode).toBe(409);
    });

    it('counts per driver: Marc still reports his own spot while Julie is capped', async () => {
      const { spotTakenReports, driverRepository, report, assigned } = await julieAfterReports(3);
      const marcSession = '00000000-0000-4000-8000-000000000953';
      spotTakenReports.add(marcSession, { ...julieSessionIn('ENTRY_CONFIRMED'), driverId: marc.id, assignedSpotNumber: 'B-1' });
      spotTakenReports.setSpot('B-1', OCCUPIED);

      const response = await server.inject({ method: 'POST', url: `/v1/entries/${marcSession}/spot-taken`, headers: await authorizationFor(driverRepository, marc), payload: { spotNumber: 'B-1' } });

      expect(response.statusCode).toBe(200);
      expect((await report(assigned)).json()).toEqual(LIMIT_BODY);
    });

    it("answers not found to Marc on Julie's capped session, and the count does not change", async () => {
      const { report, assigned, driverRepository, spotTakenReports } = await julieAfterReports(3);

      const response = await report(assigned, await authorizationFor(driverRepository, marc));

      expect(response.statusCode).toBe(404);
      expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)?.reportedSpotNumbers).toHaveLength(3);
    });

    it('accepts exactly one of two reports sent together at two reports', async () => {
      const { report, assigned } = await julieAfterReports(2);

      const responses = await Promise.all([report(assigned), report(assigned)]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    });
  });

  it('answers 503 LOT_BUSY when the lot stays locked', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();
    spotTakenReports.isLotBusy = true;

    const response = await report('A-1');

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
  });

  it.each([
    ['an empty number', ''],
    ['a number of spaces only', '   '],
    ['a number past 16 characters', 'A-'.padEnd(17, '1')],
    ['a number given as a number', 1],
    ['no number', undefined],
    ['a NUL character', 'A\u00001'],
  ])('answers 400 to %s, and changes nothing', async (_case, spotNumber) => {
    const { report, spotTakenReports } = await julieThroughTheGate();

    const response = await report(spotNumber);

    expect(response.statusCode).toBe(400);
    expect(spotTakenReports.writes).toBe(0);
  });

  it('refuses a driver who has not accepted the privacy notice', async () => {
    const { report, driverRepository } = await julieThroughTheGate();
    await acceptNoticeAs(driverRepository, julie, '2025-01-01');

    const response = await report('A-1');

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
  });

  it('answers 401 without a driver token', async () => {
    const { report } = await julieThroughTheGate();

    expect((await report('A-1', {})).statusCode).toBe(401);
  });
});

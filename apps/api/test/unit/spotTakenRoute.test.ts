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

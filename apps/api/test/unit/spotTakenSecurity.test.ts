import type { EntrySessionState } from '@palier/shared-types';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { chooseReplacementSpot } from '../../src/domain/allocation/chooseReplacementSpot.ts';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { freeSpotFixture } from './fakes/freeSpotFixture.ts';
import type { StoredReportSpot } from './fakes/fakeSpotTakenReports.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';

// Pentest proofs for story #23. Every assertion here is the secure behaviour: the surface is closed, so these stay green.
const OCCUPIED: StoredReportSpot = { state: 'OCCUPIED', needsCheck: false };
const FLAGGED: StoredReportSpot = { state: 'OCCUPIED_UNKNOWN', needsCheck: true };
const DEMO_SPOTS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'] as const;
const UNKNOWN_SESSION = '00000000-0000-4000-8000-0000000009ff';

interface ReportResponse {
  readonly outcome: 'reassigned' | 'none-free';
  readonly spot?: { readonly number: string };
}

describe('POST /v1/entries/:sessionId/spot-taken security (story #23)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieThroughTheGate(state: EntrySessionState = 'ENTRY_CONFIRMED') {
    const configured = configureServer();
    server = configured.server;
    const { spotTakenReports, driverRepository } = configured;
    spotTakenReports.add(JULIE_SESSION_ID, { driverId: julie.id, state, assignedSpotNumber: 'A-1', parkedAisleCode: null });
    spotTakenReports.setSpot('A-1', OCCUPIED);
    await acceptNoticeAs(driverRepository, julie);
    await acceptNoticeAs(driverRepository, marc);
    const julieHeaders = await authorizationFor(driverRepository, julie);
    const reportAs = (headers: Record<string, string>, payload: Record<string, unknown>) =>
      server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot-taken`, headers, payload });
    const report = (spotNumber: string) => reportAs(julieHeaders, { spotNumber });
    return { ...configured, julieHeaders, reportAs, report };
  }

  it('treats another driver reaching for a session like an unknown one: same 404, nothing touched (IDOR, no enumeration)', async () => {
    const { reportAs, spotTakenReports, driverRepository } = await julieThroughTheGate();
    const marcHeaders = await authorizationFor(driverRepository, marc);

    const atJulies = await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot-taken`, headers: marcHeaders, payload: { spotNumber: 'A-1' } });
    const atUnknown = await server.inject({ method: 'POST', url: `/v1/entries/${UNKNOWN_SESSION}/spot-taken`, headers: marcHeaders, payload: { spotNumber: 'A-1' } });

    expect(atJulies.statusCode).toBe(404);
    expect(atJulies.json()).toEqual(SESSION_NOT_FOUND_BODY);
    // A valid session the attacker does not own is indistinguishable from one that does not exist.
    expect(atUnknown.statusCode).toBe(atJulies.statusCode);
    expect(atUnknown.json()).toEqual(atJulies.json());
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ assignedSpotNumber: 'A-1', reportedSpotNumbers: [] });
    expect(spotTakenReports.spotOf('A-1')).toEqual(OCCUPIED);
    expect(reportAs).toBeDefined();
  });

  it('ignores privileged body fields: the report follows the token driver and the state machine, not the payload (no mass assignment)', async () => {
    const { reportAs, julieHeaders, spotTakenReports, driverRepository } = await julieThroughTheGate();

    const forged = await reportAs(julieHeaders, {
      spotNumber: 'A-1',
      driverId: marc.id,
      userId: marc.id,
      state: 'CANCELLED',
      assignedSpotNumber: 'B-5',
      flagsReported: false,
      reportedSpotNumbers: ['B-5'],
    });

    expect(forged.statusCode).toBe(200);
    expect(forged.json()).toEqual({ outcome: 'reassigned', spot: { number: 'A-2', levelCode: 'P1', aisleCode: 'A' } });
    // state:'CANCELLED' ignored, attribution stays Julie's, flagsReported:false ignored (A-1 was OCCUPIED, so it is flagged).
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'ENTRY_CONFIRMED', assignedSpotNumber: 'A-2', reportedSpotNumbers: ['A-1'] });
    expect(spotTakenReports.spotOf('A-1')).toEqual(FLAGGED);

    const marcHeaders = await authorizationFor(driverRepository, marc);
    const impersonation = await reportAs(marcHeaders, { spotNumber: 'A-1', driverId: julie.id, userId: julie.id });
    expect(impersonation.statusCode).toBe(404);
  });

  it.each(['CREATED', 'CANCELLED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'] as const)(
    'writes nothing when the session is %s',
    async (state) => {
      const { report, spotTakenReports } = await julieThroughTheGate(state);

      const response = await report('A-1');

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(spotTakenReports.writes).toBe(0);
      expect(spotTakenReports.spotOf('A-1')).toEqual(OCCUPIED);
    },
  );

  // Accepted risk (decision 022): no cap on reports per session. One consented driver can flag the whole lot, but it is
  // bounded by the free-spot count and self-terminates: once no spot is free the driver is parked and further reports refuse.
  it('lets one driver flag every spot in the lot, bounded by its free spots, then self-terminates', async () => {
    const { report, spotTakenReports } = await julieThroughTheGate();

    let response = await report('A-1');
    let body = response.json() as ReportResponse;
    let successes = 0;
    while (response.statusCode === 200) {
      successes += 1;
      if (body.outcome === 'none-free') {
        break;
      }
      response = await report(body.spot?.number ?? '');
      body = response.json() as ReportResponse;
    }

    expect(body.outcome).toBe('none-free');
    // Exactly one report per spot: the lot size caps the damage, it is not unbounded.
    expect(successes).toBe(DEMO_SPOTS.length);
    for (const number of DEMO_SPOTS) {
      expect(spotTakenReports.spotOf(number)).toEqual(FLAGGED);
    }
    expect(spotTakenReports.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_UNCONFIRMED' });

    const afterParked = await report('B-5');
    expect(afterParked.statusCode).toBe(409);
    expect(afterParked.json()).toMatchObject({ error: 'ALREADY_PARKED' });
  });

  it('never offers the reported spot back as the replacement, even AVAILABLE and nearest the exit', () => {
    const reported = { id: 'A-1', aisleId: 'aisle-A' };
    const freedReportedNearestExit = freeSpotFixture('A-1', { id: 'A-1', aisleId: 'aisle-A', distanceToExit: 0 });
    const other = freeSpotFixture('A-2', { id: 'A-2', aisleId: 'aisle-A', distanceToExit: 100 });

    expect(chooseReplacementSpot(standardNeeds, [freedReportedNearestExit, other], reported)?.id).toBe('A-2');
    // When the reported spot is the only AVAILABLE one, the driver is sent to the question, never back onto it.
    expect(chooseReplacementSpot(standardNeeds, [freedReportedNearestExit], reported)).toBeNull();
  });
});

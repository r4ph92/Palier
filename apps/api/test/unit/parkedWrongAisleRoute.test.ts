import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredWalkingSession } from './fakes/fakeParkedPresumptions.ts';

const CONFIRMED_AT = new Date('2026-11-04T18:03:00Z');
const WALKED_AT = '2026-11-04T18:05:00.000Z';
const LATER_WALK = '2026-11-04T18:09:00.000Z';
const AISLE_A_MINOR = 1;
const AISLE_B_MINOR = 2;
const UNKNOWN_MINOR = 77;

function julieAtA1(): StoredWalkingSession {
  return { driverId: julie.id, state: 'ENTRY_CONFIRMED', entryConfirmedAt: CONFIRMED_AT, parkedAt: null };
}

describe('POST /v1/entries/:sessionId/parked with the detected aisle (story #21)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieInside() {
    const configured = configureServer();
    server = configured.server;
    configured.parkedPresumptions.add(JULIE_SESSION_ID, julieAtA1());
    await acceptNoticeAs(configured.driverRepository, julie);
    const headers = await authorizationFor(configured.driverRepository, julie);
    const walk = (payload: Record<string, unknown>) => server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/parked`, headers, payload });
    return { ...configured, walk };
  }

  it('asks where Julie parked and flags A-1 to check when she walked away in aisle B', async () => {
    const { walk, parkedPresumptions } = await julieInside();

    const response = await walk({ detectedAt: WALKED_AT, detectedAisleMinor: AISLE_B_MINOR });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'PARKED_UNCONFIRMED', parkedAt: WALKED_AT });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ state: 'PARKED_UNCONFIRMED', parkedAisleMinor: AISLE_B_MINOR, isAssignedSpotFlagged: true });
  });

  it.each([
    ['in the assigned spot aisle', AISLE_A_MINOR],
    ['with a minor the lot does not know', UNKNOWN_MINOR],
  ])('presumes A-1 as before for a walk %s', async (_case, detectedAisleMinor) => {
    const { walk, parkedPresumptions } = await julieInside();

    const response = await walk({ detectedAt: WALKED_AT, detectedAisleMinor });

    expect(response.json()).toEqual({ state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toMatchObject({ isAssignedSpotFlagged: false });
  });

  it('answers the first walk again, without a write, when a second one arrives while the question waits', async () => {
    const { walk, parkedPresumptions } = await julieInside();
    await walk({ detectedAt: WALKED_AT, detectedAisleMinor: AISLE_B_MINOR });

    const again = await walk({ detectedAt: LATER_WALK, detectedAisleMinor: AISLE_A_MINOR });

    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ state: 'PARKED_UNCONFIRMED', parkedAt: WALKED_AT });
    expect(parkedPresumptions.writes).toBe(1);
  });

  it('answers 503 LOT_BUSY, and changes nothing, when the lot stays locked', async () => {
    const { walk, parkedPresumptions } = await julieInside();
    parkedPresumptions.isLotBusy = true;

    const response = await walk({ detectedAt: WALKED_AT, detectedAisleMinor: AISLE_B_MINOR });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ statusCode: 503, error: 'LOT_BUSY', message: 'The parking lot is busy; try again.' });
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieAtA1());
  });

  it.each([
    ['a negative minor', -1],
    ['a fractional minor', 1.5],
    ['a minor given as text', '2'],
    ['a minor past the 16 bits of an iBeacon', 65_536],
    ['a null minor', null],
  ])('answers 400 to %s, and changes nothing', async (_case, detectedAisleMinor) => {
    const { walk, parkedPresumptions } = await julieInside();

    const response = await walk({ detectedAt: WALKED_AT, detectedAisleMinor });

    expect(response.statusCode).toBe(400);
    expect(parkedPresumptions.sessionOf(JULIE_SESSION_ID)).toEqual(julieAtA1());
  });
});

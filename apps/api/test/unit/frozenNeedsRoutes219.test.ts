import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { julieSessionIn, julieWithAnsweringSession, SPOT_NOT_SUITABLE_BODY } from './parkedAnswerRig.ts';

const EVERY_NEED_CLAIMED = { isElectric: true, hasAccessiblePermit: true, isOversize: true };

describe('#219: needs sent in a request body have no effect', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it.each(['A-5', 'B-5'])('refuses Julie, standard at entry, the reserved %s even when the answer claims every need', async (spotNumber) => {
    const rig = await julieWithAnsweringSession(julieSessionIn('PARKED_UNCONFIRMED'), { 'A-1': { state: 'OCCUPIED_UNKNOWN', needsCheck: true } });
    server = rig.server;
    const headers = await authorizationFor(rig.driverRepository, julie);

    const response = await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber, ...EVERY_NEED_CLAIMED } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(SPOT_NOT_SUITABLE_BODY);
    expect(rig.parkedAnswers.spotOf(spotNumber)).toEqual({ state: 'AVAILABLE', needsCheck: false });
    expect(rig.parkedAnswers.sessionOf(JULIE_SESSION_ID)).toEqual(julieSessionIn('PARKED_UNCONFIRMED'));
    expect(rig.parkedAnswers.writes).toBe(0);
  });

  it('gives Julie a standard spot, never the free electric A-5, when « Place prise » claims every need', async () => {
    const configured = configureServer();
    server = configured.server;
    const { spotTakenReports, driverRepository } = configured;
    spotTakenReports.add(JULIE_SESSION_ID, { driverId: julie.id, state: 'ENTRY_CONFIRMED', assignedSpotNumber: 'A-1', parkedAisleCode: null });
    ['A-1', 'A-2', 'A-3', 'A-4'].forEach((number) => spotTakenReports.setSpot(number, { state: 'OCCUPIED', needsCheck: false }));
    spotTakenReports.setSpot('A-5', { state: 'AVAILABLE', needsCheck: false, isEv: true });
    await acceptNoticeAs(driverRepository, julie);
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot-taken`, headers, payload: { spotNumber: 'A-1', ...EVERY_NEED_CLAIMED } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'reassigned', spot: { number: 'B-1' } });
    expect(spotTakenReports.spotOf('A-5')).toMatchObject({ state: 'AVAILABLE' });
  });
});

// The only write of the needs is the entry's insert: no update of a session, from any route, sets them (story #219).
describe('#219: an open session never has its needs changed', () => {
  const sourceDirectory = new URL('../../src/', import.meta.url);
  const sources = readdirSync(sourceDirectory, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(new URL(name, sourceDirectory), 'utf8') }));
  const sessionUpdates = sources.flatMap(({ name, text }) => [...text.matchAll(/update\s+parking_session\s+set[\s\S]*?\b(?:where|from)\b/gi)].map(([statement]) => ({ name, statement })));

  it('finds every session update it checks', () => {
    expect(sessionUpdates.length).toBeGreaterThanOrEqual(19);
  });

  it('sets no need in any session update', () => {
    const settingNeeds = sessionUpdates.filter(({ statement }) => /is_electric|has_accessible_permit|is_oversize/.test(statement));

    expect(settingNeeds).toEqual([]);
  });

  it('writes no need through a Drizzle update of the session', () => {
    expect(sources.filter(({ text }) => /\.update\(parkingSession\)/.test(text)).map(({ name }) => name)).toEqual([]);
  });
});

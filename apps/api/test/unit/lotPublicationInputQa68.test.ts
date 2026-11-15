import { afterEach, describe, expect, it } from 'vitest';
import type { LotPublication } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotPublicationRepository } from './fakes/fakeLotPublicationRepository.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';
import { lotPublicationRoutesOf, type LotPublicationRoutes } from './fakes/lotPublicationRoutes.ts';
import { GARAGE_ROY_NORD_ID, readyGarageRoyNord } from './fakes/publicationFixtures.ts';

const MIDDAY = new Date('2026-11-15T17:00:00Z');
const measured = { measuredOn: '2026-11-14', note: 'Trois barres au P1' };

describe('go-live input under attack (QA #68)', () => {
  let server: FastifyInstance;
  let publication: FakeLotPublicationRepository;
  let routes: LotPublicationRoutes;

  afterEach(() => server.close());

  async function signedIn(): Promise<Cookies> {
    const started = startDashboardServer();
    ({ server, lotPublication: publication } = started);
    started.testClock?.setFixed(MIDDAY);
    publication.withLot(ROY_OPERATOR_ID, readyGarageRoyNord({ wifi: null }));
    routes = lotPublicationRoutesOf(server);
    return dashboardCookieFor(server, pierre);
  }

  it.each([
    ['a Hangul filler', { note: 'ㅤㅤ' }, 'ATTESTATION_NOTE_INVALID'],
    ['Braille blanks', { note: '⠀⠀' }, 'ATTESTATION_NOTE_INVALID'],
    ['an ideographic space', { note: '　' }, 'ATTESTATION_NOTE_INVALID'],
    ['a right-to-left override', { note: 'P1 ‮ bon' }, 'ATTESTATION_NOTE_INVALID'],
    ['a NUL character', { note: 'P1\u0000' }, 'ATTESTATION_NOTE_INVALID'],
    ['a lone surrogate', { note: 'P1 \ud800' }, 'ATTESTATION_NOTE_INVALID'],
    ['punctuation only', { note: '...' }, 'ATTESTATION_NOTE_INVALID'],
    ['a day with a leading space', { measuredOn: ' 2026-11-14' }, 'ATTESTATION_DAY_INVALID'],
    ['a day with a time', { measuredOn: '2026-11-14T00:00:00Z' }, 'ATTESTATION_DAY_INVALID'],
    ['a day in full-width digits', { measuredOn: '２０２６-11-14' }, 'ATTESTATION_DAY_INVALID'],
    ['29 February of a common year', { measuredOn: '2025-02-29' }, 'ATTESTATION_DAY_INVALID'],
    ['an empty day', { measuredOn: '' }, 'ATTESTATION_DAY_INVALID'],
    ['the year 9999', { measuredOn: '9999-12-31' }, 'ATTESTATION_DAY_IN_FUTURE'],
  ])('refuses a measure with %s, and nothing is recorded', async (_case, change, code) => {
    const cookies = await signedIn();

    const response = await routes.attestWifi(cookies, { ...measured, ...change });

    expect([response.statusCode, response.json<{ error: string }>().error]).toEqual([400, code]);
    expect((await routes.readPublication(cookies)).json<LotPublication>().wifi).toBeNull();
  });

  it.each([
    ['2020-01-01, the first day allowed', { measuredOn: '2020-01-01' }],
    ['29 February of a leap year', { measuredOn: '2024-02-29' }],
    ['300 accented letters typed as combining marks', { note: 'é'.repeat(300) }],
    ['a letter and 299 emoji', { note: `P${'📶'.repeat(299)}` }],
  ])('accepts %s', async (_case, change) => {
    const cookies = await signedIn();

    expect((await routes.attestWifi(cookies, { ...measured, ...change })).statusCode).toBe(200);
  });

  it('keeps markup and SQL in a note as plain text, and never takes the lot online through extra keys', async () => {
    const cookies = await signedIn();
    const note = `<script>alert(1)</script> P1'); update parking_lot set is_online = true; --`;

    const response = await routes.attestWifi(cookies, { ...measured, note, isOnline: true, wifi_verified_at: '2000-01-01' });

    expect(response.json<LotPublication>().wifi).toEqual({ measuredOn: measured.measuredOn, note });
    expect(response.json<LotPublication>().isOnline).toBe(false);
  });

  it.each([
    ['online as 1', { online: 1 }],
    ['online as 0', { online: 0 }],
    ['online as "false"', { online: 'false' }],
    ['online in an array', [{ online: true }]],
  ])('refuses %s with 400 and changes nothing', async (_case, payload) => {
    const cookies = await signedIn();

    const response = await server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${GARAGE_ROY_NORD_ID}/online`, cookies, headers: writeHeader, payload });

    expect(response.statusCode).toBe(400);
    expect(publication.changes).toEqual([]);
  });

  it('answers 401 to a visitor on every go-live route before reading the body', async () => {
    await signedIn();

    const answers = await Promise.all([
      routes.readPublication({}),
      routes.changeOnline({}, true),
      routes.attestWifi({}, measured),
      routes.attestCellular({}, { not: 'a measure' }),
    ]);

    expect(answers.map(({ statusCode }) => statusCode)).toEqual([401, 401, 401, 401]);
  });
});

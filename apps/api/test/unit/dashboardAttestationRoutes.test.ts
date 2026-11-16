import { afterEach, describe, expect, it } from 'vitest';
import type { LotPublication } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotPublicationRepository } from './fakes/fakeLotPublicationRepository.ts';
import { lotPublicationRoutesOf, type LotPublicationRoutes } from './fakes/lotPublicationRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';
import { readyGarageRoyNord } from './fakes/publicationFixtures.ts';

// 22 h in Montréal on 2026-11-15, already the 16th in UTC.
const LATE_EVENING = new Date('2026-11-16T03:00:00Z');
const measured = { measuredOn: '2026-11-14', note: 'Signal mesuré aux niveaux P1 et P2, trois barres partout.' };

describe('dashboard attestation routes', () => {
  let server: FastifyInstance;
  let publication: FakeLotPublicationRepository;
  let routes: LotPublicationRoutes;

  afterEach(() => server.close());

  async function signedIn(user = pierre): Promise<Cookies> {
    const started = startDashboardServer();
    ({ server, lotPublication: publication } = started);
    if (started.testClock === undefined) {
      throw new Error('The dashboard test server runs without its test clock.');
    }
    started.testClock.setFixed(LATE_EVENING);
    publication.withLot(ROY_OPERATOR_ID, readyGarageRoyNord({ wifi: null, cellular: null }));
    routes = lotPublicationRoutesOf(server);
    return dashboardCookieFor(server, user);
  }

  it('records Pierre’s Wi-Fi measure, and the checklist shows its date and note', async () => {
    const cookies = await signedIn();

    const response = await routes.attestWifi(cookies, measured);

    expect(response.statusCode).toBe(200);
    expect(response.json<LotPublication>().wifi).toEqual(measured);
    expect(response.json<LotPublication>().missing).toEqual([{ code: 'CELLULAR_NOT_ATTESTED', gateId: null }]);
  });

  it('records the cellular measure apart from the Wi-Fi one', async () => {
    const cookies = await signedIn();

    const response = await routes.attestCellular(cookies, measured);

    expect(response.json<LotPublication>().cellular).toEqual(measured);
    expect(response.json<LotPublication>().wifi).toBeNull();
  });

  it('stores the note as it reads, every run of spaces or line breaks one plain space', async () => {
    const cookies = await signedIn();

    const response = await routes.attestWifi(cookies, { ...measured, note: '  Trois\u00a0 barres\nau P2  ' });

    expect(response.json<LotPublication>().wifi?.note).toBe('Trois barres au P2');
  });

  it('takes today on Montréal’s calendar: the 15th is accepted late in the evening, the 16th is not yet', async () => {
    const cookies = await signedIn();

    const today = await routes.attestWifi(cookies, { ...measured, measuredOn: '2026-11-15' });
    const tomorrow = await routes.attestWifi(cookies, { ...measured, measuredOn: '2026-11-16' });

    expect(today.statusCode).toBe(200);
    expect(tomorrow.statusCode).toBe(400);
    expect(tomorrow.json()).toMatchObject({ error: 'ATTESTATION_DAY_IN_FUTURE' });
  });

  it.each([
    ['a day before 2020', { measuredOn: '2019-06-01' }, 'ATTESTATION_DAY_INVALID'],
    ['a day not on the calendar', { measuredOn: '2026-02-30' }, 'ATTESTATION_DAY_INVALID'],
    ['an empty note', { note: ' ' }, 'ATTESTATION_NOTE_INVALID'],
    ['a note with a zero-width space', { note: 'P1\u200bbon' }, 'ATTESTATION_NOTE_INVALID'],
    ['a 301-character note', { note: 'a'.repeat(301) }, 'ATTESTATION_NOTE_INVALID'],
  ])('refuses %s with its code, and nothing is recorded', async (_case, change, code) => {
    const cookies = await signedIn();

    const response = await routes.attestWifi(cookies, { ...measured, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: code });
    expect((await routes.readPublication(cookies)).json<LotPublication>().wifi).toBeNull();
  });

  it.each([
    ['no note', { measuredOn: measured.measuredOn }],
    ['a day sent as a number', { ...measured, measuredOn: 20261114 }],
    ['a note past the shape limit', { ...measured, note: 'a'.repeat(4097) }],
  ])('refuses %s with 400 before reading the lot', async (_case, payload) => {
    const cookies = await signedIn();

    expect((await routes.attestCellular(cookies, payload)).statusCode).toBe(400);
  });

  it('gives Sophie not found on Pierre’s lot for both attestations, and nothing is recorded', async () => {
    const cookies = await signedIn(sophie);

    const wifi = await routes.attestWifi(cookies, measured);
    const cellular = await routes.attestCellular(cookies, measured);

    expect([wifi.statusCode, cellular.statusCode]).toEqual([404, 404]);
    expect(wifi.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    const pierreCookies = await dashboardCookieFor(server, pierre);
    const { wifi: storedWifi, cellular: storedCellular } = (await routes.readPublication(pierreCookies)).json<LotPublication>();
    expect([storedWifi, storedCellular]).toEqual([null, null]);
  });

  it('answers 503 LOT_BUSY when the lot stays locked', async () => {
    const cookies = await signedIn();
    publication.busyLots.add(readyGarageRoyNord().lotId);

    expect((await routes.attestWifi(cookies, measured)).json()).toMatchObject({ error: 'LOT_BUSY' });
  });
});

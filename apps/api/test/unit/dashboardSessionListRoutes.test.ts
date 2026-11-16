import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardSessionList } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeSessionTimelineRepository } from './fakes/fakeSessionTimelineRepository.ts';
import { sessionIdOf, sessionOf } from './fakes/sessionTimelineFixtures.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000999';

describe('the list of the sessions of a lot', () => {
  let server: FastifyInstance;
  let timelines: FakeSessionTimelineRepository;
  let sophieCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, sessionTimelines: timelines } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
  });

  afterEach(() => server.close());

  const list = (query = '', lotId = PARKING_DEMO_ID, cookies = sophieCookies) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/sessions${query}`, cookies });

  function enter(minute: number, overrides: Parameters<typeof sessionOf>[0] = {}) {
    const session = sessionOf({ enteredAt: new Date(Date.UTC(2026, 10, 15, 14, minute)), ...overrides });
    timelines.sessions.push(session);
    return session;
  }

  it('lists the open sessions newest first by default', async () => {
    const first = enter(0);
    const second = enter(30, { state: 'PARKED_CONFIRMED' });
    enter(45, { state: 'CLOSED_PAID', capturedCents: 800, exitedAt: new Date('2026-11-15T15:00:00.000Z') });
    enter(50, { state: 'CANCELLED' });

    const body = (await list()).json<DashboardSessionList>();

    expect(body.sessions.map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(body.lotName).toBe('Parking Démo');
    expect(body.nextCursor).toBeNull();
  });

  it('counts a vehicle that left with its capture pending as closed', async () => {
    enter(0, { state: 'CLOSED_CAPTURE_PENDING', pendingCaptureCents: 900 });

    expect((await list('?status=OPEN')).json<DashboardSessionList>().sessions).toEqual([]);
  });

  it('lists every session, closed ones with their amount, when asked for ALL', async () => {
    enter(0, { state: 'CLOSED_PAID', capturedCents: 800, surplusPaidCents: 100 });
    enter(30);

    const { sessions } = (await list('?status=ALL')).json<DashboardSessionList>();

    expect(sessions.map(({ state, amountCents }) => [state, amountCents])).toEqual([
      ['ENTRY_CONFIRMED', null],
      ['CLOSED_PAID', 900],
    ]);
  });

  it('breaks a tie of entry time by id, newest id first', async () => {
    const low = enter(0);
    const high = enter(0);

    const ids = (await list()).json<DashboardSessionList>().sessions.map(({ id }) => id);

    expect(ids).toEqual([high.id, low.id]);
  });

  it('pages by 50 and hands the last id of a full page as the cursor of the next', async () => {
    const entered = Array.from({ length: 52 }, (_, minute) => enter(minute));
    const newestFirst = [...entered].reverse();

    const firstPage = (await list('?status=ALL')).json<DashboardSessionList>();
    const secondPage = (await list(`?status=ALL&before=${firstPage.nextCursor}`)).json<DashboardSessionList>();

    expect(firstPage.sessions).toHaveLength(50);
    expect(firstPage.nextCursor).toBe(newestFirst[49]?.id);
    expect(secondPage.sessions.map(({ id }) => id)).toEqual(newestFirst.slice(50).map(({ id }) => id));
    expect(secondPage.nextCursor).toBeNull();
  });

  it('has no next page when exactly 50 sessions exist', async () => {
    Array.from({ length: 50 }, (_, minute) => enter(minute));

    expect((await list('?status=ALL')).json<DashboardSessionList>().nextCursor).toBeNull();
  });

  it('gives an empty page for a cursor that is no session of this lot', async () => {
    const ofAnotherLot = sessionOf({ lotId: PARKING_TEST_PALIERS_ID });
    timelines.sessions.push(ofAnotherLot);
    enter(0);

    expect((await list(`?before=${ofAnotherLot.id}`)).json<DashboardSessionList>().sessions).toEqual([]);
    expect((await list(`?before=${UNKNOWN_ID}`)).json<DashboardSessionList>().sessions).toEqual([]);
  });

  it.each(['?status=foo', '?status=', '?before=garbage', '?before=', `?before=${sessionIdOf(1)}&before=${sessionIdOf(2)}`])('refuses the query %s with a 400', async (query) => {
    const response = await list(query);

    expect(response.statusCode).toBe(400);
  });

  it('answers another operator the lot 404, the same as for an unknown or a malformed lot', async () => {
    enter(0);
    const pierreCookies = await dashboardCookieFor(server, pierre);

    const responses = [await list('', PARKING_DEMO_ID, pierreCookies), await list('', UNKNOWN_ID, pierreCookies), await list('', 'not-a-uuid', pierreCookies)];

    for (const response of responses) {
      expect([response.statusCode, response.json()]).toEqual([404, LOT_NOT_FOUND]);
    }
  });

  it('lists nothing of Parking Démo for the sessions of another lot of the same operator', async () => {
    enter(0);

    expect((await list('?status=ALL', PARKING_TEST_PALIERS_ID)).json<DashboardSessionList>().sessions).toEqual([]);
  });

  it('never answers a driver, a card or a payment reference in a row', async () => {
    enter(0);
    Object.assign(timelines.sessions[0] ?? {}, { userId: 'u-1', paymentIntentId: 'pi_secret', cardLast4: '4242' });

    const text = (await list()).body;

    for (const hidden of ['u-1', 'pi_secret', '4242', 'userId', 'paymentIntent', 'cardLast4']) {
      expect(text).not.toContain(hidden);
    }
  });

  it('refuses a visitor with no session', async () => {
    const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/sessions` });

    expect(response.statusCode).toBe(401);
  });
});

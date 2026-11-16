import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardSessionDetail, DashboardSessionList } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeSessionTimelineRepository } from './fakes/fakeSessionTimelineRepository.ts';
import { eventOf, fullVisitEvents, sessionOf } from './fakes/sessionTimelineFixtures.ts';

const RANDOM_ID = '11111111-1111-4111-8111-111111111111';
const UNKNOWN_LOT_ID = '22222222-2222-4222-8222-222222222222';
const LEFT_AT = new Date('2026-11-16T16:00:00.000Z');

describe('QA #72: the session routes under attack', () => {
  let server: FastifyInstance;
  let timelines: FakeSessionTimelineRepository;
  let sophieCookies: Record<string, string>;
  let pierreCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, sessionTimelines: timelines } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
    pierreCookies = await dashboardCookieFor(server, pierre);
  });

  afterEach(() => server.close());

  const get = (url: string, cookies = sophieCookies) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${url}`, cookies });

  describe('AC5: Pierre cannot tell Julie\'s session from an id that does not exist', () => {
    it('answers Julie\'s session under Parking Démo exactly like a random id there and like an unknown lot', async () => {
      const julies = sessionOf({ events: fullVisitEvents() });
      timelines.sessions.push(julies);

      const answers = await Promise.all([
        get(`${PARKING_DEMO_ID}/sessions/${julies.id}`, pierreCookies),
        get(`${PARKING_DEMO_ID}/sessions/${RANDOM_ID}`, pierreCookies),
        get(`${UNKNOWN_LOT_ID}/sessions/${julies.id}`, pierreCookies),
      ]);

      const shapes = answers.map((answer) => [answer.statusCode, answer.body]);
      expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
      expect(answers[0]?.statusCode).toBe(404);
    });

    it('answers Julie\'s session under his own Garage Roy exactly like a random and a malformed id there', async () => {
      const julies = sessionOf();
      timelines.sessions.push(julies);

      const answers = await Promise.all([
        get(`${GARAGE_ROY_ID}/sessions/${julies.id}`, pierreCookies),
        get(`${GARAGE_ROY_ID}/sessions/${RANDOM_ID}`, pierreCookies),
        get(`${GARAGE_ROY_ID}/sessions/not-a-uuid`, pierreCookies),
        get(`${GARAGE_ROY_ID}/sessions/${julies.id.toUpperCase()}`, pierreCookies),
      ]);

      expect(new Set(answers.map((answer) => `${answer.statusCode} ${answer.body}`)).size).toBe(1);
    });

    it('lists nothing of Julie when he pages his own lot with her session as the cursor', async () => {
      const julies = sessionOf({ state: 'CLOSED_PAID', exitedAt: LEFT_AT, capturedCents: 75, exitMethod: 'APP' });
      timelines.sessions.push(julies);

      const response = await get(`${GARAGE_ROY_ID}/sessions?status=ALL&before=${julies.id}`, pierreCookies);

      expect(response.json<DashboardSessionList>()).toEqual({ lotName: 'Garage Roy', sessions: [], nextCursor: null });
      expect(response.body).not.toContain('ABC 123');
    });
  });

  describe('a hostile list query', () => {
    it.each([
      ['a repeated status', 'status=OPEN&status=ALL'],
      ['a lower-case status', 'status=open'],
      ['an empty status', 'status='],
      ['an empty cursor', 'before='],
      ['an SQL fragment as cursor', `before=${encodeURIComponent("' or 1=1--")}`],
      ['a urn-prefixed cursor', `before=urn:uuid:${RANDOM_ID}`],
    ])('refuses %s with 400 and no session', async (_, query) => {
      timelines.sessions.push(sessionOf());

      const response = await get(`${PARKING_DEMO_ID}/sessions?${query}`);

      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain('ABC 123');
    });
  });

  describe('AC2 and AC3 through the route', () => {
    it('carries the refused balance on the capture step and in the summary', async () => {
      const unpaid = sessionOf({
        state: 'CLOSED_PAID',
        exitedAt: LEFT_AT,
        exitMethod: 'APP',
        capturedCents: 2500,
        unpaidCents: 675,
        events: [eventOf(7, 'CAPTURED', { capturedCents: 2500, surplusPaidCents: 0, unpaidCents: 675 })],
      });
      timelines.sessions.push(unpaid);

      const body = (await get(`${PARKING_DEMO_ID}/sessions/${unpaid.id}`)).json<DashboardSessionDetail>();

      expect(body.summary).toMatchObject({ amountCents: 2500, unpaidCents: 675 });
      expect(body.timeline).toEqual([expect.objectContaining({ kind: 'CAPTURED', details: { amountCents: 2500, unpaidCents: 675 } })]);
    });

    it('shows a pending capture of a stay over 24 h with its surplus, and no capture step', async () => {
      const pending = sessionOf({
        state: 'CLOSED_CAPTURE_PENDING',
        exitedAt: LEFT_AT,
        exitMethod: 'PLATE',
        pendingCaptureCents: 2500,
        pendingSurplusCents: 600,
        events: [...fullVisitEvents().slice(0, 6), eventOf(7, 'CAPTURE_PENDING', { pendingCaptureCents: 2500, pendingSurplusCents: 600 })],
      });
      timelines.sessions.push(pending);

      const body = (await get(`${PARKING_DEMO_ID}/sessions/${pending.id}`)).json<DashboardSessionDetail>();

      expect(body.summary.amountCents).toBe(3100);
      expect(body.timeline.at(-1)).toMatchObject({ kind: 'CAPTURE_PENDING', details: { amountCents: 3100 } });
      expect(body.timeline.some(({ kind }) => kind === 'CAPTURED')).toBe(false);
    });

    it('counts a retried capture once, in the summary and on both payment steps', async () => {
      const retried = sessionOf({
        state: 'CLOSED_PAID',
        exitedAt: LEFT_AT,
        exitMethod: 'PLATE',
        capturedCents: 2500,
        surplusPaidCents: 600,
        pendingCaptureCents: 2500,
        pendingSurplusCents: 600,
        events: [
          eventOf(3, 'CAPTURE_PENDING', { pendingCaptureCents: 2500, pendingSurplusCents: 600 }),
          eventOf(5, 'CAPTURED', { capturedCents: 2500, surplusPaidCents: 600, unpaidCents: 0 }),
        ],
      });
      timelines.sessions.push(retried);

      const body = (await get(`${PARKING_DEMO_ID}/sessions/${retried.id}`)).json<DashboardSessionDetail>();

      expect(body.summary.amountCents).toBe(3100);
      expect(body.timeline.map(({ details }) => details.amountCents)).toEqual([3100, 3100]);
    });
  });

  describe('privacy of the step numbers', () => {
    // Found by QA: event_log.sequence is one identity for every lot of every operator, so the numbers Sophie reads count Pierre's traffic too.
    it('answers the same timeline whether or not other lots wrote events between its steps', async () => {
      const alone = sessionOf({ events: [eventOf(1, 'ENTRY_SCANNED', { spotNumber: 'A-1' }), eventOf(2, 'GATE_OPENED', { direction: 'ENTRY' })] });
      const interleaved = sessionOf({ events: [eventOf(1000, 'ENTRY_SCANNED', { spotNumber: 'A-1' }), eventOf(1450, 'GATE_OPENED', { direction: 'ENTRY' })] });
      timelines.sessions.push(alone, interleaved);

      const [first, second] = await Promise.all([alone, interleaved].map(({ id }) => get(`${PARKING_DEMO_ID}/sessions/${id}`)));

      expect(second?.json<DashboardSessionDetail>().timeline).toEqual(first?.json<DashboardSessionDetail>().timeline);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardSessionDetail } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeSessionTimelineRepository } from './fakes/fakeSessionTimelineRepository.ts';
import { eventOf, fullVisitEvents, GATE_ID, sessionOf } from './fakes/sessionTimelineFixtures.ts';

const LOT_NOT_FOUND = { statusCode: 404, error: 'LOT_NOT_FOUND', message: 'No such lot.' };
const SESSION_NOT_FOUND = { statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such session.' };
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000999';

describe('the sessions of a lot and the timeline of one', () => {
  let server: FastifyInstance;
  let timelines: FakeSessionTimelineRepository;
  let sophieCookies: Record<string, string>;

  beforeEach(async () => {
    ({ server, sessionTimelines: timelines } = startDashboardServer());
    sophieCookies = await dashboardCookieFor(server, sophie);
  });

  afterEach(() => server.close());

  const detail = (sessionId: string, lotId = PARKING_DEMO_ID, cookies = sophieCookies) =>
    server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/sessions/${sessionId}`, cookies });

  describe('the detail of a session', () => {
    it('gives the summary and every step of a full visit in the order they were written', async () => {
      const visit = sessionOf({
        state: 'CLOSED_PAID',
        exitedAt: new Date('2026-11-15T16:00:02.000Z'),
        presumedBy: 'WALK',
        exitMethod: 'PLATE',
        capturedCents: 1200,
        events: fullVisitEvents().reverse(),
      });
      timelines.sessions.push(visit);

      const response = await detail(visit.id);

      expect(response.statusCode).toBe(200);
      const body = response.json<DashboardSessionDetail>();
      expect(body.lotName).toBe('Parking Démo');
      expect(body.summary).toEqual({
        plate: 'ABC 123',
        state: 'CLOSED_PAID',
        assignedSpotNumber: 'A-1',
        realSpotNumber: 'A-1',
        parkingEvidence: 'ON_FOOT',
        exitMethod: 'PLATE',
        amountCents: 1200,
        unpaidCents: 0,
        entryAt: '2026-11-15T14:00:00.000Z',
        exitAt: '2026-11-15T16:00:02.000Z',
      });
      expect(body.timeline.map(({ sequence, kind }) => [sequence, kind])).toEqual([
        [1, 'ENTRY_SCANNED'],
        [2, 'GATE_OPENED'],
        [3, 'ENTRY_LOOP_CLOSED'],
        [4, 'AISLE_DETECTED'],
        [5, 'PARKING_PRESUMED'],
        [6, 'EXIT_IDENTIFIED'],
        [7, 'GATE_OPENED'],
        [8, 'CAPTURED'],
        [9, 'EXIT_LOOP_CLOSED'],
      ]);
      expect(body.timeline.filter(({ kind }) => kind === 'GATE_OPENED').map(({ details }) => details.direction)).toEqual(['ENTRY', 'EXIT']);
    });

    it('gives an empty timeline for a session with no event', async () => {
      const bare = sessionOf();
      timelines.sessions.push(bare);

      expect((await detail(bare.id)).json<DashboardSessionDetail>().timeline).toEqual([]);
    });

    it('shows a step of a kind it does not know as a step with its time only', async () => {
      const visit = sessionOf({ events: [eventOf(1, 'SPOT_TAKEN_REPORTED', { spotId: 'x', email: 'julie.tremblay@palier.test' })] });
      timelines.sessions.push(visit);

      const [step] = (await detail(visit.id)).json<DashboardSessionDetail>().timeline;

      expect(step).toEqual({ sequence: 1, kind: 'UNKNOWN', occurredAt: '2026-11-15T14:00:00.000Z', details: {} });
    });

    it('never answers an id, a driver, a card or a payment reference', async () => {
      const visit = sessionOf({
        state: 'CLOSED_PAID',
        exitedAt: new Date('2026-11-15T16:00:02.000Z'),
        presumedBy: 'WALK',
        capturedCents: 1200,
        events: [...fullVisitEvents(), eventOf(10, 'CAPTURED', { capturedCents: 5, email: 'julie.tremblay@palier.test', paymentIntentId: 'pi_secret', cardLast4: '4242', userId: 'u-1' })],
      });
      Object.assign(visit, { userId: 'u-1', paymentIntentId: 'pi_secret', cardLast4: '4242', vehicleId: 'v-1' });
      timelines.sessions.push(visit);

      const text = (await detail(visit.id)).body;

      for (const hidden of [GATE_ID, 'command-1', 'gateId', 'commandId', 'aisleId', 'spotId', 'beaconMinor', 'userId', 'u-1', '@palier.test', 'pi_secret', 'paymentIntent', '4242', 'cardLast4', 'vehicleId']) {
        expect(text).not.toContain(hidden);
      }
    });

    it('refuses another operator with the lot 404, and a session of another lot with the session 404', async () => {
      const julies = sessionOf();
      timelines.sessions.push(julies);
      const pierreCookies = await dashboardCookieFor(server, pierre);

      const foreignLot = await detail(julies.id, PARKING_DEMO_ID, pierreCookies);
      const ownLotForeignSession = await detail(julies.id, GARAGE_ROY_ID, pierreCookies);
      const ownLotUnknownSession = await detail(UNKNOWN_ID, GARAGE_ROY_ID, pierreCookies);

      expect([foreignLot.statusCode, foreignLot.json()]).toEqual([404, LOT_NOT_FOUND]);
      expect([ownLotForeignSession.statusCode, ownLotForeignSession.json()]).toEqual([404, SESSION_NOT_FOUND]);
      expect(ownLotForeignSession.json()).toEqual(ownLotUnknownSession.json());
    });

    it('refuses a session of another lot of the same operator with the session 404', async () => {
      const inDemo = sessionOf();
      timelines.sessions.push(inDemo);

      const response = await detail(inDemo.id, PARKING_TEST_PALIERS_ID);

      expect([response.statusCode, response.json()]).toEqual([404, SESSION_NOT_FOUND]);
    });

    it('answers a malformed lot id the lot 404 and a malformed session id the session 404', async () => {
      const badLot = await detail(UNKNOWN_ID, 'not-a-uuid');
      const badSession = await detail('not-a-uuid');

      expect(badLot.json()).toEqual(LOT_NOT_FOUND);
      expect(badSession.json()).toEqual(SESSION_NOT_FOUND);
    });

    it('refuses a visitor with no session', async () => {
      const response = await server.inject({ method: 'GET', url: `/v1/dashboard/lots/${PARKING_DEMO_ID}/sessions/${UNKNOWN_ID}` });

      expect(response.statusCode).toBe(401);
    });
  });
});

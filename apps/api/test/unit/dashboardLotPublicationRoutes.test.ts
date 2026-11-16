import { afterEach, describe, expect, it } from 'vitest';
import type { LotPublication } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotPublicationRepository } from './fakes/fakeLotPublicationRepository.ts';
import type { FakeLotStore } from './fakes/fakeLotSetupRepository.ts';
import { lotPublicationRoutesOf, type LotPublicationRoutes } from './fakes/lotPublicationRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';
import { entreeNord, GARAGE_ROY_NORD_ID, readyGarageRoyNord, sortieNord, VERIFIED_AT } from './fakes/publicationFixtures.ts';
import type { PublicationFacts } from '../../src/domain/publication/lotPrerequisites.ts';

describe('dashboard publication routes', () => {
  let server: FastifyInstance;
  let publication: FakeLotPublicationRepository;
  let lots: FakeLotStore;
  let routes: LotPublicationRoutes;

  afterEach(() => server.close());

  async function signedIn(user = pierre, facts: PublicationFacts = readyGarageRoyNord()): Promise<Cookies> {
    ({ server, lotPublication: publication, lots } = startDashboardServer());
    publication.withLot(ROY_OPERATOR_ID, facts);
    routes = lotPublicationRoutesOf(server);
    return dashboardCookieFor(server, user);
  }

  describe('reading the checklist', () => {
    it('shows Pierre each prerequisite of Garage Roy Nord with its state, and each gate with its verified date', async () => {
      const cookies = await signedIn();

      const response = await routes.readPublication(cookies);

      expect(response.statusCode).toBe(200);
      expect(response.json<LotPublication>()).toEqual({
        lotId: GARAGE_ROY_NORD_ID,
        lotName: 'Garage Roy Nord',
        isOnline: false,
        stripe: { kycStatus: 'VERIFIED' },
        pricing: { dailyCapCents: 2500 },
        spots: { inServiceCount: 4, capacity: 4 },
        wifi: { measuredOn: '2026-11-12', note: 'Signal mesuré aux niveaux P1 et P2.' },
        cellular: { measuredOn: '2026-11-12', note: 'Quatre barres aux deux bornes.' },
        gates: [entreeNord, sortieNord],
        missing: [],
      });
    });

    it('names what is missing, a gate by its id', async () => {
      const cookies = await signedIn(pierre, readyGarageRoyNord({ wifi: null, gates: [entreeNord, { ...sortieNord, verifiedAt: null }] }));

      const { missing, gates } = (await routes.readPublication(cookies)).json<LotPublication>();

      expect(missing).toEqual([{ code: 'WIFI_NOT_ATTESTED', gateId: null }, { code: 'GATE_UNVERIFIED', gateId: sortieNord.id }]);
      expect(gates.map(({ verifiedAt }) => verifiedAt)).toEqual([VERIFIED_AT, null]);
    });

    it('answers 404 for an id that is not a lot id', async () => {
      const cookies = await signedIn();

      const response = await server.inject({ method: 'GET', url: '/v1/dashboard/lots/garage-roy-nord/publication', cookies });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    });
  });

  describe('going online and offline', () => {
    it('puts Garage Roy Nord online once every prerequisite is met, and the lot reads online', async () => {
      const cookies = await signedIn();

      const response = await routes.changeOnline(cookies, true);

      expect(response.statusCode).toBe(200);
      expect(response.json<LotPublication>().isOnline).toBe(true);
      expect(lots.byId(GARAGE_ROY_NORD_ID)?.isOnline).toBe(true);
    });

    it('refuses to go online with 409 LOT_NOT_READY while anything is missing, and nothing changes', async () => {
      const cookies = await signedIn(pierre, readyGarageRoyNord({ cellular: null }));

      const response = await routes.changeOnline(cookies, true);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'LOT_NOT_READY' });
      expect(response.json()).not.toHaveProperty('values');
      expect(publication.changes).toEqual([]);
      expect(lots.byId(GARAGE_ROY_NORD_ID)?.isOnline).toBe(false);
    });

    it('takes the lot offline whatever is missing, and a second press changes nothing', async () => {
      const cookies = await signedIn(pierre, readyGarageRoyNord({ isOnline: true, wifi: null }));

      const first = await routes.changeOnline(cookies, false);
      const second = await routes.changeOnline(cookies, false);

      expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
      expect(second.json<LotPublication>().isOnline).toBe(false);
      expect(lots.byId(GARAGE_ROY_NORD_ID)?.isOnline).toBe(false);
    });

    it('answers 503 LOT_BUSY when the lot stays locked, and nothing changes', async () => {
      const cookies = await signedIn();
      publication.busyLots.add(GARAGE_ROY_NORD_ID);

      const response = await routes.changeOnline(cookies, true);

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'LOT_BUSY' });
      expect(lots.byId(GARAGE_ROY_NORD_ID)?.isOnline).toBe(false);
    });

    it.each([
      ['no body', undefined],
      ['online as text', { online: 'true' }],
      ['online as null', { online: null }],
    ])('refuses %s with 400 and changes nothing', async (_case, payload) => {
      const cookies = await signedIn();

      const response = await server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${GARAGE_ROY_NORD_ID}/online`, cookies, headers: writeHeader, ...(payload === undefined ? {} : { payload }) });

      expect(response.statusCode).toBe(400);
      expect(publication.changes).toEqual([]);
    });
  });

  describe('another operator', () => {
    it('gives Sophie not found on Pierre’s lot, for the checklist and for going online, and nothing changes', async () => {
      const cookies = await signedIn(sophie);

      const read = await routes.readPublication(cookies);
      const published = await routes.changeOnline(cookies, true);
      const unpublished = await routes.changeOnline(cookies, false);

      for (const response of [read, published, unpublished]) {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
      }
      expect(publication.changes).toEqual([]);
      expect(lots.byId(GARAGE_ROY_NORD_ID)?.isOnline).toBe(false);
    });
  });
});

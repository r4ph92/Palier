import { afterEach, describe, expect, it } from 'vitest';
import type { CreatedGate, DashboardLotGates } from '@palier/shared-types';
import { MAX_GATES_PER_LOT } from '@palier/shared-types/gateDraft';
import type { FastifyInstance } from 'fastify';
import { hashDeviceKey } from '../../src/domain/gates/hashDeviceKey.ts';
import { ENTREE_ROY_ID } from '../../src/seed/fixtures/gates.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotGateRepository } from './fakes/fakeLotGateRepository.ts';
import { entreePrincipale, lotGateRoutesOf, settingsOf, sortieNord, type LotGateRoutes } from './fakes/lotGateRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';

const DEVICE_KEY = /^[A-Za-z0-9_-]{43}$/;

describe('dashboard gate routes', () => {
  let server: FastifyInstance;
  let gates: FakeLotGateRepository;
  let routes: LotGateRoutes;

  afterEach(() => server.close());

  async function pierreOnGarageRoy(): Promise<Cookies> {
    ({ server, lotGates: gates } = startDashboardServer());
    routes = lotGateRoutesOf(server);
    return dashboardCookieFor(server, pierre);
  }

  function gateNamed(body: DashboardLotGates, name: string) {
    return body.gates.find((gate) => gate.name === name);
  }

  describe('adding a gate', () => {
    it('adds Entrée principale on the access-control API, and the list shows it with its settings', async () => {
      const cookies = await pierreOnGarageRoy();

      const added = await routes.addGate(cookies, entreePrincipale);

      expect(added.statusCode).toBe(201);
      const listed = (await routes.readGates(cookies)).json<DashboardLotGates>();
      expect(listed.lotName).toBe('Garage Roy');
      expect(gateNamed(listed, 'Entrée principale')).toEqual({ id: added.json<CreatedGate>().gateId, ...entreePrincipale });
    });

    it.each([
      ['an http endpoint', { endpoint: 'http://controle.garageroy.ca' }, 'GATE_ENDPOINT_NOT_HTTPS'],
      ['the access-control API without an endpoint', { endpoint: null }, 'GATE_ENDPOINT_REQUIRED'],
      ['a blank endpoint on the access-control API', { endpoint: '   ' }, 'GATE_ENDPOINT_REQUIRED'],
      ['an entry gate reading plates', { exitIdentification: 'PLATE' }, 'GATE_EXIT_ID_ON_ENTRY'],
      ['a blank name', { name: ' ' }, 'GATE_NAME_REQUIRED'],
    ])('refuses %s with 400 %s and adds nothing', async (_case, change, error) => {
      const cookies = await pierreOnGarageRoy();

      const refused = await routes.addGate(cookies, { ...entreePrincipale, ...change });

      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({ error });
      expect(gates.gates.filter(({ lotId }) => lotId === GARAGE_ROY_ID)).toHaveLength(1);
    });

    it('refuses a name already used in the lot with 409 GATE_NAME_TAKEN', async () => {
      const cookies = await pierreOnGarageRoy();

      const refused = await routes.addGate(cookies, { ...entreePrincipale, name: 'Entrée Roy' });

      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ error: 'GATE_NAME_TAKEN' });
    });

    it('refuses a second exit gate in the lot with 409 GATE_EXIT_LIMIT', async () => {
      const cookies = await pierreOnGarageRoy();
      expect((await routes.addGate(cookies, sortieNord)).statusCode).toBe(201);

      const refused = await routes.addGate(cookies, { ...sortieNord, name: 'Sortie Sud' });

      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ error: 'GATE_EXIT_LIMIT', message: 'One exit gate per parking lot for now.' });
    });

    it(`refuses a gate past ${MAX_GATES_PER_LOT} in one lot with 409 GATE_LIMIT_REACHED`, async () => {
      const cookies = await pierreOnGarageRoy();
      for (let index = 1; index < MAX_GATES_PER_LOT; index += 1) {
        gates.gates.push({ ...entreePrincipale, id: `gate-${index}`, name: `Entrée ${index}`, lotId: GARAGE_ROY_ID, qrSecret: null });
      }

      const refused = await routes.addGate(cookies, entreePrincipale);

      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ error: 'GATE_LIMIT_REACHED' });
    });

    it('answers LOT_BUSY with Retry-After while another write holds the lot', async () => {
      const cookies = await pierreOnGarageRoy();
      gates.busyLots.add(GARAGE_ROY_ID);

      const busy = await routes.addGate(cookies, entreePrincipale);

      expect(busy.statusCode).toBe(503);
      expect(busy.headers['retry-after']).toBe('3');
    });
  });

  describe('the device key of a new gate', () => {
    it('answers the key once, uncached, and stores only its hash', async () => {
      const cookies = await pierreOnGarageRoy();

      const added = await routes.addGate(cookies, entreePrincipale);

      const { gateId, deviceKey } = added.json<CreatedGate>();
      expect(deviceKey).toMatch(DEVICE_KEY);
      expect(added.headers['cache-control']).toBe('no-store');
      expect(gates.deviceKeys.find((key) => key.gateId === gateId)?.keyHash).toBe(hashDeviceKey(deviceKey));
      const listed = await routes.readGates(cookies);
      expect(listed.body).not.toContain(deviceKey);
      expect(listed.body).not.toContain(hashDeviceKey(deviceKey));
    });

    it('never lists a QR secret', async () => {
      const cookies = await pierreOnGarageRoy();

      const listed = await routes.readGates(cookies);

      const secret = gates.gates.find(({ id }) => id === ENTREE_ROY_ID)?.qrSecret ?? 'none';
      expect(listed.body).not.toContain(secret);
      expect(listed.body).not.toMatch(/qrSecret|keyHash|deviceKey/);
    });
  });

  describe('changing a gate', () => {
    it('sets an exit gate to read plates, then transponders, then nothing, and the list shows each', async () => {
      const cookies = await pierreOnGarageRoy();
      const { gateId } = (await routes.addGate(cookies, sortieNord)).json<CreatedGate>();

      for (const exitIdentification of ['PLATE', 'TRANSPONDER', 'NONE'] as const) {
        const changed = await routes.changeGate(cookies, gateId, { ...settingsOf(sortieNord), exitIdentification });
        expect(changed.statusCode).toBe(200);
        expect(gateNamed(changed.json<DashboardLotGates>(), 'Sortie Nord')?.exitIdentification).toBe(exitIdentification);
      }
    });

    it('refuses an exit identification on an entry gate and keeps it as it was', async () => {
      const cookies = await pierreOnGarageRoy();

      const refused = await routes.changeGate(cookies, ENTREE_ROY_ID, { ...settingsOf(entreePrincipale), name: 'Entrée Roy', exitIdentification: 'PLATE' });

      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({ error: 'GATE_EXIT_ID_ON_ENTRY' });
      expect(gates.gates.find(({ id }) => id === ENTREE_ROY_ID)?.integrationKind).toBe('DRY_CONTACT');
    });

    it('refuses an http endpoint, and never changes the direction a body names', async () => {
      const cookies = await pierreOnGarageRoy();

      expect((await routes.changeGate(cookies, ENTREE_ROY_ID, { ...settingsOf(entreePrincipale), endpoint: 'http://a.ca' })).json()).toMatchObject({ error: 'GATE_ENDPOINT_NOT_HTTPS' });
      const changed = await routes.changeGate(cookies, ENTREE_ROY_ID, { ...entreePrincipale, name: 'Entrée Roy', kind: 'EXIT' });
      expect(gateNamed(changed.json<DashboardLotGates>(), 'Entrée Roy')).toMatchObject({ kind: 'ENTRY', integrationKind: 'ACCESS_CONTROL_API' });
    });
  });
});

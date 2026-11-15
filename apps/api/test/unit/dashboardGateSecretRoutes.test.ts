import { afterEach, describe, expect, it } from 'vitest';
import type { CreatedGate, GateDeviceKey, GateQrLink } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { isSignedWith, readGateToken, type GateToken } from '../../src/domain/entries/gateToken.ts';
import { hashDeviceKey } from '../../src/domain/gates/hashDeviceKey.ts';
import { ENTREE_ROY_DEVICE_KEY, ENTREE_ROY_ID } from '../../src/seed/fixtures/gates.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import type { FakeLotGateRepository } from './fakes/fakeLotGateRepository.ts';
import { entreePrincipale, lotGateRoutesOf, sortieNord, type LotGateRoutes } from './fakes/lotGateRoutes.ts';
import type { Cookies } from './fakes/lotMapRoutes.ts';

describe('dashboard gate secret routes', () => {
  let server: FastifyInstance;
  let gates: FakeLotGateRepository;
  let routes: LotGateRoutes;

  afterEach(() => server.close());

  async function pierreOnGarageRoy(): Promise<Cookies> {
    ({ server, lotGates: gates } = startDashboardServer());
    routes = lotGateRoutesOf(server);
    return dashboardCookieFor(server, pierre);
  }

  function heartbeat(deviceKey: string, gateId = ENTREE_ROY_ID) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/heartbeat`, headers: { authorization: `Bearer ${deviceKey}` } });
  }

  function storedSecretOf(gateId: string): string | null {
    return gates.gates.find(({ id }) => id === gateId)?.qrSecret ?? null;
  }

  async function tokenOf(cookies: Cookies, gateId: string): Promise<GateToken | null> {
    return readGateToken((await routes.readQrLink(cookies, gateId)).json<GateQrLink>().link);
  }

  describe('regenerating the device key', () => {
    it('answers a new key once, uncached; the controller holding the old one is refused, the new one heard', async () => {
      const cookies = await pierreOnGarageRoy();
      expect((await heartbeat(ENTREE_ROY_DEVICE_KEY)).statusCode).toBe(204);

      const replaced = await routes.replaceDeviceKey(cookies, ENTREE_ROY_ID);

      expect(replaced.statusCode).toBe(200);
      expect(replaced.headers['cache-control']).toBe('no-store');
      const { gateId, deviceKey } = replaced.json<GateDeviceKey>();
      expect(gateId).toBe(ENTREE_ROY_ID);
      expect(deviceKey).not.toBe(ENTREE_ROY_DEVICE_KEY);
      expect((await heartbeat(ENTREE_ROY_DEVICE_KEY)).statusCode).toBe(401);
      expect((await heartbeat(deviceKey)).statusCode).toBe(204);
      expect(gates.deviceKeys.filter((key) => key.gateId === ENTREE_ROY_ID && key.revokedAt === null).map(({ keyHash }) => keyHash)).toEqual([hashDeviceKey(deviceKey)]);
    });

    it('lets the key answered when the gate was added authenticate it', async () => {
      const cookies = await pierreOnGarageRoy();

      const { gateId, deviceKey } = (await routes.addGate(cookies, entreePrincipale)).json<CreatedGate>();

      expect((await heartbeat(deviceKey, gateId)).statusCode).toBe(204);
    });
  });

  describe('the QR link', () => {
    it.each([
      ['an entry gate', entreePrincipale],
      ['an exit gate', sortieNord],
    ])('signs the link of %s with that gate’s own secret, never answering the secret', async (_case, draft) => {
      const cookies = await pierreOnGarageRoy();
      const { gateId } = (await routes.addGate(cookies, draft)).json<CreatedGate>();

      const read = await routes.readQrLink(cookies, gateId);

      expect(read.headers['cache-control']).toBe('no-store');
      const link = read.json<GateQrLink>().link;
      expect(link.startsWith('https://palier.app/q/palier1.')).toBe(true);
      const token = readGateToken(link);
      expect(token?.gateId).toBe(gateId);
      expect(token !== null && isSignedWith(token, storedSecretOf(gateId))).toBe(true);
      expect(read.body).not.toContain(storedSecretOf(gateId) ?? 'none');
    });

    it('gives a gate without a secret one on the first print, and the same link after', async () => {
      const cookies = await pierreOnGarageRoy();
      const roy = gates.gates.find(({ id }) => id === ENTREE_ROY_ID);
      if (roy !== undefined) {
        roy.qrSecret = null;
      }

      const first = await routes.readQrLink(cookies, ENTREE_ROY_ID);

      expect(first.statusCode).toBe(200);
      expect(storedSecretOf(ENTREE_ROY_ID)).not.toBeNull();
      expect((await routes.readQrLink(cookies, ENTREE_ROY_ID.toUpperCase())).json()).toEqual(first.json());
    });
  });

  describe('regenerating the QR secret', () => {
    it('signs the next link with a new secret, so the printed one no longer verifies', async () => {
      const cookies = await pierreOnGarageRoy();
      const printed = await tokenOf(cookies, ENTREE_ROY_ID);
      const before = storedSecretOf(ENTREE_ROY_ID);

      const replaced = await routes.replaceQrSecret(cookies, ENTREE_ROY_ID);

      expect(replaced.statusCode).toBe(204);
      const after = storedSecretOf(ENTREE_ROY_ID);
      expect(after).not.toBe(before);
      expect(printed !== null && isSignedWith(printed, after)).toBe(false);
      const reprinted = await tokenOf(cookies, ENTREE_ROY_ID);
      expect(reprinted !== null && isSignedWith(reprinted, after)).toBe(true);
    });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import {
  ENTREE_DEMO_KEY,
  entreeDemo,
  FakeGateDeviceKeyRepository,
  FakePassageLedger,
  REVOKED_KEY,
  SORTIE_DEMO_KEY,
  sortieDemo,
  UNKNOWN_KEY,
} from './fakes/gateFixtures.ts';
import { NOW, serverDependencies } from './fakes/serverDependencies.ts';

const REFUSED_KEY_BODY = { statusCode: 401, error: 'DEVICE_KEY_REFUSED', message: 'Device key refused.' };

describe('gate routes', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;

  function startServer(vehicleCount = 0, deviceKeys = new FakeGateDeviceKeyRepository()): void {
    ledger = new FakePassageLedger(vehicleCount);
    server = buildServer(serverDependencies({ gates: { deviceKeys, ledger, clock: () => NOW } }));
  }

  function postPassage(gateId: string, headers: Record<string, string>, payload: object = { closedAt: NOW.toISOString() }) {
    return server.inject({ method: 'POST', url: `/v1/gates/${gateId}/passage`, headers, payload });
  }

  function bearer(deviceKey: string): Record<string, string> {
    return { authorization: `Bearer ${deviceKey}` };
  }

  afterEach(() => server.close());

  describe('POST /v1/gates/:id/passage', () => {
    it('counts the vehicle in and answers the new vehicle count', async () => {
      startServer(0);

      const response = await postPassage(entreeDemo.id, bearer(ENTREE_DEMO_KEY));

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        gateId: entreeDemo.id,
        lotId: entreeDemo.lotId,
        kind: 'ENTRY',
        closedAt: NOW.toISOString(),
        vehicleCount: 1,
      });
    });

    it('counts the vehicle out at the exit gate', async () => {
      startServer(1);

      const response = await postPassage(sortieDemo.id, bearer(SORTIE_DEMO_KEY));

      expect(response.json()).toMatchObject({ kind: 'EXIT', vehicleCount: 0 });
    });

    it.each([
      ['no Authorization header', {}],
      ['a scheme other than Bearer', { authorization: `Basic ${ENTREE_DEMO_KEY}` }],
      ['a malformed key', { authorization: 'Bearer short' }],
      ['an unknown key', bearer(UNKNOWN_KEY)],
      ['a revoked key', bearer(REVOKED_KEY)],
    ])('refuses %s with the same 401 and counts nothing', async (_case, headers) => {
      startServer(0);

      const response = await postPassage(entreeDemo.id, headers);

      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.json()).toEqual(REFUSED_KEY_BODY);
      expect(ledger.entries).toEqual([]);
    });

    it('refuses the key before looking at the body', async () => {
      startServer(0);

      const response = await postPassage(entreeDemo.id, bearer(UNKNOWN_KEY), { closedAt: 'not a date' });

      expect(response.statusCode).toBe(401);
    });

    it('forbids the Entrée Démo key from reporting a passage at Sortie Démo', async () => {
      startServer(1);

      const response = await postPassage(sortieDemo.id, bearer(ENTREE_DEMO_KEY));

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'GATE_FORBIDDEN' });
      expect(ledger.entries).toEqual([]);
      expect(ledger.vehicleCount).toBe(1);
    });

    it('answers 409 for a gate without loops', async () => {
      const keyOfGateWithoutLoops = 'noLoopsKey000000000000000000000000000000000';
      startServer(0, new FakeGateDeviceKeyRepository().withGate(keyOfGateWithoutLoops, { ...entreeDemo, hasLoops: false }));

      const response = await postPassage(entreeDemo.id, bearer(keyOfGateWithoutLoops));

      expect(response.statusCode).toBe(409);
      expect(ledger.entries).toEqual([]);
    });

    it.each([
      ['a closedAt that is not a date', { closedAt: 'yesterday' }],
      ['a missing closedAt', {}],
      ['a closedAt 6 minutes in the future', { closedAt: new Date(NOW.getTime() + 6 * 60 * 1000).toISOString() }],
    ])('answers 400 for %s', async (_case, payload) => {
      startServer(0);

      const response = await postPassage(entreeDemo.id, bearer(ENTREE_DEMO_KEY), payload);

      expect(response.statusCode).toBe(400);
      expect(ledger.entries).toEqual([]);
    });

    it('ignores a lot or a kind sent in the body', async () => {
      startServer(0);

      const response = await postPassage(entreeDemo.id, bearer(ENTREE_DEMO_KEY), {
        closedAt: NOW.toISOString(),
        lotId: 'another-lot',
        kind: 'EXIT',
      });

      expect(response.json()).toMatchObject({ lotId: entreeDemo.lotId, kind: 'ENTRY', vehicleCount: 1 });
    });
  });

  describe('GET /v1/gates/me', () => {
    it('names the gate of the key, its kind and its lot, and nothing else', async () => {
      startServer();

      const response = await server.inject({ method: 'GET', url: '/v1/gates/me', headers: bearer(SORTIE_DEMO_KEY) });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: sortieDemo.id, name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' });
    });

    it('refuses a revoked key', async () => {
      startServer();

      const response = await server.inject({ method: 'GET', url: '/v1/gates/me', headers: bearer(REVOKED_KEY) });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(REFUSED_KEY_BODY);
    });
  });
});

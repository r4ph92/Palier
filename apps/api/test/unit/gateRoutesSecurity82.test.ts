import Fastify, { type FastifyInstance, type HTTPMethods } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/http/buildServer.ts';
import { authenticatedGateOf, authenticatedKeyHashOf } from '../../src/http/gates/gateDeviceAuthentication.ts';
import { handleGateError } from '../../src/http/gates/handleGateError.ts';
import { registeredRoutes } from './configureServer.ts';
import { FakeExits } from './fakes/fakeExits.ts';
import {
  ENTREE_DEMO_KEY,
  entreeDemo,
  FakeEquipmentReports,
  FakeGateCommandFeed,
  FakeGateDeviceKeyRepository,
  FakePassageLedger,
  REVOKED_KEY,
  sortieDemo,
  UNKNOWN_KEY,
} from './fakes/gateFixtures.ts';
import { NOW, serverDependencies, SIXTY_SECOND_WINDOW } from './fakes/serverDependencies.ts';

// Adversarial regression guard for story #82 — the properties proven live against the lane API (see
// .claude/work/82-gate-console-polish/pentest.log). The console now sends any printable key of up to 512 characters and the
// gate decorations are read through a `== null` guard: every gate route must still refuse before it writes anything.
const REFUSED_KEY_BODY = { statusCode: 401, error: 'DEVICE_KEY_REFUSED', message: 'Device key refused.' };
const NOTHING_WRITTEN = { passages: [], replayed: [], heartbeats: [], batteries: [], verified: [], closings: [] };
const PRINTABLE_ASCII = Array.from({ length: 94 }, (_unused, index) => String.fromCharCode(0x21 + index)).join('');
const bearer = (deviceKey: string): Record<string, string> => ({ authorization: `Bearer ${deviceKey}` });

const REFUSED_CREDENTIALS: readonly (readonly [string, Record<string, string>])[] = [
  ['no Authorization header', {}],
  ['the revoked key', bearer(REVOKED_KEY)],
  ['a well-formed key Palier never issued', bearer(UNKNOWN_KEY)],
  ['512 printable characters, the longest key the console sends', bearer('~'.repeat(512))],
  ['every printable ASCII character', bearer(PRINTABLE_ASCII)],
  ['the real key and one more character', bearer(`${ENTREE_DEMO_KEY}A`)],
  ['the real key less its last character', bearer(ENTREE_DEMO_KEY.slice(0, -1))],
  ['the real key under the Basic scheme', { authorization: `Basic ${ENTREE_DEMO_KEY}` }],
  ['the real key under a lowercase scheme', { authorization: `bearer ${ENTREE_DEMO_KEY}` }],
  ['the real key followed by a second token', { authorization: `Bearer ${ENTREE_DEMO_KEY} ${ENTREE_DEMO_KEY}` }],
  ['the real key in a cookie and in a header of its own', { cookie: `authorization=${ENTREE_DEMO_KEY}`, 'x-device-key': ENTREE_DEMO_KEY }],
];

// A body each route accepts, so that only the key or the ownership check can refuse the request.
const VALID_PAYLOADS: Record<string, object> = {
  'POST /v1/gates/:id/passage': { closedAt: NOW.toISOString() },
  'POST /v1/gates/:id/passages/replay': { passages: [{ id: '00000000-0000-4000-8000-0000000000a1', kind: 'ENTRY', closedAt: NOW.toISOString() }] },
  'POST /v1/gates/:id/identify': { identifier: 'ABC123' },
  'POST /v1/gates/:id/beacons/:minor/battery': { percent: 50 },
};

describe('story #82 attack surface: gate routes behind the device key', () => {
  let server: FastifyInstance;
  let ledger: FakePassageLedger;
  let equipment: FakeEquipmentReports;
  let exits: FakeExits;

  beforeEach(() => {
    ledger = new FakePassageLedger();
    equipment = new FakeEquipmentReports();
    exits = new FakeExits();
    const gates = { deviceKeys: new FakeGateDeviceKeyRepository(), ledger, passageClock: () => NOW, commands: new FakeGateCommandFeed(), openingWindow: SIXTY_SECOND_WINDOW, equipment };
    server = buildServer(serverDependencies({ gates, exits: { exits, payments: null } }));
  });

  afterEach(() => server.close());

  // Read from the route tree, so a gate route added later is attacked too.
  async function gateRoutes(): Promise<string[]> {
    return (await registeredRoutes(server)).filter((route) => route.includes(' /v1/gates/'));
  }

  function send(route: string, gateId: string, headers: Record<string, string>) {
    const [method = '', path = ''] = route.split(' ');
    const payload = VALID_PAYLOADS[route];
    const url = path.replace(':id', gateId).replace(':minor', '0');
    return server.inject({ method: method as HTTPMethods, url, headers, ...(payload === undefined ? {} : { payload }) });
  }

  function writes() {
    return {
      passages: ledger.entries,
      replayed: ledger.replayed,
      heartbeats: [...equipment.heartbeats],
      batteries: equipment.batteries,
      verified: [...equipment.verifiedAt],
      closings: exits.closings,
    };
  }

  it('finds the nine gate routes of the story, each of them open to the right key only', async () => {
    const routes = await gateRoutes();

    expect(routes.length).toBeGreaterThanOrEqual(9);
    expect((await send('GET /v1/gates/me', entreeDemo.id, bearer(ENTREE_DEMO_KEY))).json()).toMatchObject({ id: entreeDemo.id, name: 'Entrée Démo' });
  });

  it.each(REFUSED_CREDENTIALS)('refuses %s on every gate route with the same 401, before anything is written', async (_case, headers) => {
    for (const route of await gateRoutes()) {
      const response = await send(route, entreeDemo.id, headers);

      expect(response.statusCode, route).toBe(401);
      expect(response.headers['www-authenticate'], route).toBe('Bearer');
      expect(response.json(), route).toEqual(REFUSED_KEY_BODY);
    }
    expect(writes()).toEqual(NOTHING_WRITTEN);
  });

  it("refuses Entrée Démo's key on every route of Sortie Démo's gate with 403, and writes nothing", async () => {
    const routesOfOneGate = (await gateRoutes()).filter((route) => route.includes(':id'));

    expect(routesOfOneGate).toHaveLength(7);
    for (const route of routesOfOneGate) {
      const response = await send(route, sortieDemo.id, bearer(ENTREE_DEMO_KEY));

      expect(response.statusCode, route).toBe(403);
      expect(response.json(), route).toMatchObject({ statusCode: 403, error: 'GATE_FORBIDDEN' });
    }
    expect(writes()).toEqual(NOTHING_WRITTEN);
  });

  it('answers a passage refused for its time with a fixed sentence that repeats nothing the caller sent', async () => {
    const future = { closedAt: '2999-12-31T23:59:59.999Z', note: '<img src=x onerror=alert(1)>' };
    const stale = { passages: [{ id: '00000000-0000-4000-8000-0000000000a2', kind: 'ENTRY', closedAt: '2026-10-01T00:00:00.000Z' }] };

    const refusedFuture = await server.inject({ method: 'POST', url: `/v1/gates/${entreeDemo.id}/passage`, headers: bearer(ENTREE_DEMO_KEY), payload: future });
    const refusedStale = await server.inject({ method: 'POST', url: `/v1/gates/${entreeDemo.id}/passages/replay`, headers: bearer(ENTREE_DEMO_KEY), payload: stale });

    expect(refusedFuture.json()).toEqual({ statusCode: 400, error: 'CLOSED_AT_IN_FUTURE', message: 'closedAt is more than 5 minutes in the future.' });
    expect(refusedStale.json()).toEqual({ statusCode: 400, error: 'CLOSED_AT_TOO_OLD', message: 'closedAt is more than 7 days in the past.' });
    expect(writes()).toEqual(NOTHING_WRITTEN);
  });
});

describe('story #82 attack surface: a gate handler reached without the device-key hook', () => {
  const withoutDecoration: (server: FastifyInstance) => void = () => undefined;
  const withNullDecoration = (server: FastifyInstance): void => {
    server.decorateRequest('authenticatedGate', null);
    server.decorateRequest('authenticatedKeyHash', null);
  };

  it.each([
    ['no decoration at all (undefined)', withoutDecoration],
    ['the decoration left at null', withNullDecoration],
  ])('answers a bare 500 with %s, never a gate and never the reason', async (_case, decorate) => {
    const server = Fastify();
    decorate(server);
    server.setErrorHandler(handleGateError);
    server.get('/v1/gates/me', (request, reply) => reply.send(authenticatedGateOf(request)));
    server.post('/v1/gates/:id/test-passage', (request, reply) => reply.send({ keyHash: authenticatedKeyHashOf(request) }));

    const identity = await server.inject({ method: 'GET', url: '/v1/gates/me', headers: bearer(ENTREE_DEMO_KEY) });
    const testPassage = await server.inject({ method: 'POST', url: `/v1/gates/${entreeDemo.id}/test-passage`, headers: bearer(ENTREE_DEMO_KEY) });
    await server.close();

    for (const response of [identity, testPassage]) {
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ statusCode: 500, error: 'Internal Server Error' });
      expect(response.body).not.toMatch(/hook|authenticat|keyHash/i);
    }
  });
});

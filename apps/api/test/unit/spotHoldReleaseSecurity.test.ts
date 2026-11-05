import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { SpotHold } from '../../src/domain/spotHolds/SpotHold.ts';
import { uuidSchema } from '../../src/http/schemas/uuidSchema.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { configureServer } from './configureServer.ts';
import { fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';
import { readyDriver } from './fakes/readyDriver.ts';

// Pentest #7: guards the release route and the shared uuid pattern against hostile path ids.
const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const JULIE_HOLD = fakeSpotHoldId(1);
const NOT_FOUND_BODY = { statusCode: 404, error: 'HOLD_NOT_FOUND', message: 'No such hold.' };
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Built from Julie's real hold id, so a pattern that let any of these through would release her hold.
const HOSTILE_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['a urn:uuid: prefix', `urn:uuid:${JULIE_HOLD}`],
  ['curly braces', encodeURIComponent(`{${JULIE_HOLD}}`)],
  ['square brackets', encodeURIComponent(`[${JULIE_HOLD}]`)],
  ['a trailing newline', `${JULIE_HOLD}%0A`],
  ['a trailing space', `${JULIE_HOLD}%20`],
  ['a leading space', `%20${JULIE_HOLD}`],
  ['a trailing tab', `${JULIE_HOLD}%09`],
  ['a trailing CRLF', `${JULIE_HOLD}%0D%0A`],
  ['an embedded null byte', `${JULIE_HOLD}%00`],
  ['extra hex appended', `${JULIE_HOLD}extrahex00`],
  ['the id doubled', `${JULIE_HOLD}-${JULIE_HOLD}`],
  ['Arabic-Indic digits', '%D9%A0%D9%A1%D9%A2%D9%A3-0000-4000-8000-000000000000'],
  ['encoded path traversal', '..%2F..%2F..%2Fetc%2Fpasswd'],
  ['a SQL fragment', encodeURIComponent("1' or '1'='1")],
];

describe('the shared uuid path pattern', () => {
  const pattern = new RegExp(uuidSchema.pattern);

  it.each([
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'F47AC10B-58CC-4372-A567-0E02B2C3D479',
    '00000000-0000-4000-8000-000000000201',
  ])('accepts the canonical uuid %s (any hex case)', (id) => {
    expect(pattern.test(id)).toBe(true);
  });

  it.each([
    ['a urn:uuid: prefix', 'urn:uuid:f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    ['curly braces', '{f47ac10b-58cc-4372-a567-0e02b2c3d479}'],
    // The crux: JavaScript `$` (no `m` flag) must not match before a trailing newline, or Postgres rejects the cast with a 500.
    ['a trailing newline', 'f47ac10b-58cc-4372-a567-0e02b2c3d479\n'],
    ['a leading newline', '\nf47ac10b-58cc-4372-a567-0e02b2c3d479'],
    ['a trailing space', 'f47ac10b-58cc-4372-a567-0e02b2c3d479 '],
    ['an embedded null byte', 'f47ac10b-58cc-4372-a567-0e02b2c3d479\u0000'],
    ['extra hex', 'f47ac10b-58cc-4372-a567-0e02b2c3d479ff'],
    ['Arabic-Indic digits', '٠١٢٣-0000-4000-8000-000000000000'],
    ['a path traversal', '../../../../etc/passwd'],
    ['a SQL fragment', "1' or '1'='1"],
    ['the empty string', ''],
  ])('rejects %s', (_case, id) => {
    expect(pattern.test(id)).toBe(false);
  });
});

describe('DELETE /v1/holds/:id: hostile ids never reach Postgres', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieHolding() {
    const configured = configureServer({ testSignInEnabled: true });
    server = configured.server;
    configured.testClock.setFixed(AT_14_02);
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    await server.inject({ method: 'POST', url: `/v1/lots/${PARKING_DEMO_ID}/holds`, headers });
    // Postgres casts the id to uuid: anything the pattern lets through that is not a real uuid fails the query (500), so a rejecting stub surfaces a bypass.
    const askedIds: string[] = [];
    const findOwn = configured.spotHolds.findOwnActiveSpotHold.bind(configured.spotHolds);
    configured.spotHolds.findOwnActiveSpotHold = (driverId: string, spotHoldId: string): Promise<SpotHold | null> => {
      askedIds.push(spotHoldId);
      return CANONICAL_UUID.test(spotHoldId) ? findOwn(driverId, spotHoldId) : Promise.reject(new Error(`invalid input syntax for type uuid: "${spotHoldId}"`));
    };
    const release = (path: string): Promise<LightMyRequestResponse> => server.inject({ method: 'DELETE', url: `/v1/holds/${path}`, headers });
    const currentHold = async () => (await server.inject({ method: 'GET', url: '/v1/me/hold', headers })).json<{ spotHold: unknown }>().spotHold;
    return { release, currentHold, spotHolds: configured.spotHolds, askedIds };
  }

  it.each(HOSTILE_PATHS)('answers the plain unknown-id 404 to %s, never a 500', async (_case, path) => {
    const { release, spotHolds, askedIds } = await startWithJulieHolding();

    const response = await release(path);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND_BODY);
    // The driver predicate never runs for a non-canonical id: validation refused it first.
    expect(askedIds.filter((id) => !CANONICAL_UUID.test(id))).toEqual([]);
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('leaves Julie’s hold intact after the whole hostile matrix, then releases it on the real id', async () => {
    const { release, currentHold, spotHolds } = await startWithJulieHolding();

    for (const [, path] of HOSTILE_PATHS) {
      await release(path);
    }

    expect(spotHolds.releases).toHaveLength(0);
    expect(await currentHold()).toMatchObject({ spotHoldId: JULIE_HOLD });
    expect((await release(JULIE_HOLD)).statusCode).toBe(204);
    expect(await currentHold()).toBeNull();
  });

  it('answers 404, not a redirect, to a trailing slash after the id', async () => {
    const { release, spotHolds } = await startWithJulieHolding();

    expect((await release(`${JULIE_HOLD}/`)).statusCode).toBe(404);
    expect(spotHolds.releases).toHaveLength(0);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';

const rectangle = { x: 0, y: 0, width: 100, height: 40 };
type Cookies = Record<string, string>;

describe('dashboard lot map routes under attack (QA #65)', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function signInPierre(): Promise<Cookies> {
    ({ server } = startDashboardServer());
    return dashboardCookieFor(server, pierre);
  }

  function readMap(cookies: Cookies) {
    return server.inject({ method: 'GET', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/map`, cookies });
  }

  function addLevel(cookies: Cookies, code: string) {
    return server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels`, cookies, headers: writeHeader, payload: { code } });
  }

  function reorder(cookies: Cookies, levelIds: readonly string[], fromLevelIds?: readonly string[]) {
    const payload = fromLevelIds === undefined ? { levelIds } : { levelIds, fromLevelIds };
    return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels/order`, cookies, headers: writeHeader, payload });
  }

  function addAisle(cookies: Cookies, levelId: string, payload: object) {
    return server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels/${levelId}/aisles`, cookies, headers: writeHeader, payload });
  }

  async function garageRoyWith(cookies: Cookies, codes: readonly string[]): Promise<DashboardLotMap> {
    let map = (await readMap(cookies)).json<DashboardLotMap>();
    for (const code of codes) {
      map = (await addLevel(cookies, code)).json<DashboardLotMap>();
    }
    return map;
  }

  function idOf(map: DashboardLotMap, code: string): string {
    return map.levels.find((level) => level.code === code)?.id ?? '';
  }

  function codesOf(map: DashboardLotMap): string[] {
    return map.levels.map(({ code }) => code);
  }

  // Plan revision 8 and decision 034: a stale list answers 409 LEVEL_ORDER_INVALID and the page reads the map again.
  it('refuses a move sent from a stale order instead of silently undoing the move another tab saved', async () => {
    const cookies = await signInPierre();
    const loaded = await garageRoyWith(cookies, ['P1', 'P2', 'P3']);
    const [p1, p2, p3] = [idOf(loaded, 'P1'), idOf(loaded, 'P2'), idOf(loaded, 'P3')];

    const firstTab = await reorder(cookies, [p1, p3, p2], [p1, p2, p3]);
    const secondTabStillShowingP1P2P3 = await reorder(cookies, [p2, p1, p3], [p1, p2, p3]);

    expect(codesOf(firstTab.json<DashboardLotMap>())).toEqual(['P1', 'P3', 'P2']);
    expect(secondTabStillShowingP1P2P3.statusCode).toBe(409);
    expect(secondTabStillShowingP1P2P3.json()).toMatchObject({ error: 'LEVEL_ORDER_INVALID' });
    expect(codesOf((await readMap(cookies)).json<DashboardLotMap>())).toEqual(['P1', 'P3', 'P2']);
  });

  // Fix round 1 checks staleness only when fromLevelIds is sent; two moves saved by another tab leave a one-step gap a stale order fits.
  it('refuses a stale move sent without fromLevelIds instead of undoing the second move another tab saved', async () => {
    const cookies = await signInPierre();
    const loaded = await garageRoyWith(cookies, ['P1', 'P2', 'P3', 'P4']);
    const [p1, p2, p3, p4] = ['P1', 'P2', 'P3', 'P4'].map((code) => idOf(loaded, code)) as [string, string, string, string];
    const url = `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels/order`;
    await server.inject({ method: 'PUT', url, cookies, headers: writeHeader, payload: { levelIds: [p2, p1, p3, p4], fromLevelIds: [p1, p2, p3, p4] } });
    await server.inject({ method: 'PUT', url, cookies, headers: writeHeader, payload: { levelIds: [p2, p1, p4, p3], fromLevelIds: [p2, p1, p3, p4] } });

    const staleTab = await reorder(cookies, [p2, p1, p3, p4]);

    expect(staleTab.statusCode).not.toBe(200);
    expect(codesOf((await readMap(cookies)).json<DashboardLotMap>())).toEqual(['P2', 'P1', 'P4', 'P3']);
  });

  it.each([
    ['an accent typed decomposed', 'É3', 'É3'],
    ['a no-break space', 'P 1', 'P 1'],
  ])('refuses a level code that reads the same as one the lot has, written with %s', async (_case, saved, lookalike) => {
    const cookies = await signInPierre();
    await garageRoyWith(cookies, [saved]);

    const response = await addLevel(cookies, lookalike);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'LEVEL_CODE_TAKEN' });
  });

  it('stores codes with markup or SQL as plain text, exactly as typed', async () => {
    const cookies = await signInPierre();

    const map = await garageRoyWith(cookies, ['<b>P</b>', "'; drop--", '🅿️3']);

    expect(codesOf(map)).toEqual(['<b>P</b>', "'; drop--", '🅿️3']);
  });

  it.each([
    ['a negative minor', { code: 'A', beaconMinor: -1, rectangle }],
    ['a minor too large for a number column', { code: 'A', beaconMinor: 1e300, rectangle }],
    ['a minor sent as text', { code: 'A', beaconMinor: '5', rectangle }],
    ['a rectangle past the grid', { code: 'A', beaconMinor: 5, rectangle: { ...rectangle, x: 10_001 } }],
    ['a rectangle side sent as text', { code: 'A', beaconMinor: 5, rectangle: { ...rectangle, x: '5' } }],
    ['a rectangle with a side missing', { code: 'A', beaconMinor: 5, rectangle: { x: 0, y: 0, width: 10 } }],
    ['a code of eleven characters', { code: 'ABCDEFGHIJK', beaconMinor: 5, rectangle }],
    ['a code with a zero-width space', { code: 'A​', beaconMinor: 5, rectangle }],
    ['no code', { beaconMinor: 5, rectangle }],
  ])('answers 400 to %s and saves nothing', async (_case, payload) => {
    const cookies = await signInPierre();
    const map = await garageRoyWith(cookies, ['P1']);

    const response = await addAisle(cookies, idOf(map, 'P1'), payload);

    expect(response.statusCode).toBe(400);
    expect((await readMap(cookies)).json()).toEqual(map);
  });

  it('saves only the four sides of a rectangle sent with an extra key, and no exit lane flag from the body', async () => {
    const cookies = await signInPierre();
    const map = await garageRoyWith(cookies, ['P1']);

    const response = await addAisle(cookies, idOf(map, 'P1'), { code: 'A', beaconMinor: 5, rectangle: { ...rectangle, z: 1 }, isExitLane: true });

    expect(response.statusCode).toBe(200);
    expect(response.json<DashboardLotMap>().levels[0]?.aisles.find(({ code }) => code === 'A')).toEqual({
      id: expect.any(String),
      code: 'A',
      beaconMinor: 5,
      isExitLane: false,
      rectangle,
      batteryPercent: null,
      batteryReportedAt: null,
      batteryStatus: 'UNKNOWN',
    });
  });
});

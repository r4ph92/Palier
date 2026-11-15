import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { authorizationFor, julie, type FakeDriverRepository } from './fakeDriverRepository.ts';
import { nouvelOperateur, pierre, sophie } from './fakes/dashboardFixtures.ts';
import { DASHBOARD_COOKIE, dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakes/fakeLotSpotRepository.ts';

// Pentest #69: durable proof of the route's security invariants; live proof is in .claude/work/69-spot-out-of-service/pentest.log.
describe('the spot service route under attack (pentest #69)', () => {
  let server: FastifyInstance;
  let spots: FakeLotSpotRepository;
  let drivers: FakeDriverRepository;

  afterEach(() => server.close());

  function parkingDemoSpotA3(): FakeSpot {
    ({ server, lotSpots: spots, driverRepository: drivers } = startDashboardServer());
    return spots.spots.find(({ lotId, number }) => lotId === PARKING_DEMO_ID && number === 'A-3') as FakeSpot;
  }

  function servicePathOf(lotId: string, spotId: string): string {
    return `/v1/dashboard/lots/${lotId}/spots/${spotId}/service`;
  }

  function setService(cookies: Record<string, string>, place: { readonly lotId: string; readonly spotId: string }, payload: object) {
    return server.inject({ method: 'PUT', url: servicePathOf(place.lotId, place.spotId), cookies, headers: writeHeader, payload });
  }

  it('takes only outOfService from the body: no state, retirement, lot or attribute is mass-assigned', async () => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);
    const forged = {
      ...{ outOfService: true, state: 'AVAILABLE', retired: true, retiredAt: '2020-01-01T00:00:00.000Z', retired_at: '2020-01-01T00:00:00.000Z' },
      ...{ id: randomUUID(), lotId: GARAGE_ROY_ID, lot_id: GARAGE_ROY_ID, aisleId: randomUUID(), aisle_id: randomUUID(), operatorId: ROY_OPERATOR_ID },
      ...{ number: 'Z-99', isEv: true, isAccessible: true, isOversize: true, distanceToExit: 0, hasHistory: true, isHeldBySession: true, needsCheck: true },
    };

    const answer = await setService(await dashboardCookieFor(server, sophie), { lotId: PARKING_DEMO_ID, spotId: spot.id }, forged);

    expect(answer.statusCode).toBe(200);
    expect(spots.spots).toEqual(before.map((row) => (row.id === spot.id ? { ...row, state: 'OUT_OF_SERVICE' } : row)));
  });

  it.each([true, false])('answers another operator’s spot exactly like a spot that does not exist (outOfService %s)', async (outOfService) => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);
    const cookies = await dashboardCookieFor(server, pierre);

    const foreign = await setService(cookies, { lotId: GARAGE_ROY_ID, spotId: spot.id }, { outOfService });
    const unknown = await setService(cookies, { lotId: GARAGE_ROY_ID, spotId: randomUUID() }, { outOfService });

    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
    expect(foreign.body).toBe(unknown.body);
    expect(spots.spots).toEqual(before);
  });

  it.each([true, false])('answers another operator’s lot exactly like a lot that does not exist (outOfService %s)', async (outOfService) => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);
    const cookies = await dashboardCookieFor(server, pierre);

    const foreign = await setService(cookies, { lotId: PARKING_DEMO_ID, spotId: spot.id }, { outOfService });
    const unknown = await setService(cookies, { lotId: randomUUID(), spotId: spot.id }, { outOfService });

    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(foreign.body).toBe(unknown.body);
    expect(spots.spots).toEqual(before);
  });

  it('keeps a busy foreign lot not found, so another operator learns nothing of its traffic', async () => {
    const spot = parkingDemoSpotA3();
    spots.busyLots.add(PARKING_DEMO_ID);

    const answer = await setService(await dashboardCookieFor(server, pierre), { lotId: PARKING_DEMO_ID, spotId: spot.id }, { outOfService: true });

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(spot.state).toBe('AVAILABLE');
  });

  it('refuses Parking Démo’s spot named under the same operator’s other lot', async () => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);

    const answer = await setService(await dashboardCookieFor(server, sophie), { lotId: PARKING_TEST_PALIERS_ID, spotId: spot.id }, { outOfService: true });

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it.each([
    ['a dashboard user of no operator', nouvelOperateur],
    ['a driver signed in to the dashboard', julie],
  ])('answers %s lot not found and changes nothing', async (_who, user) => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);

    const answer = await setService(await dashboardCookieFor(server, user), { lotId: PARKING_DEMO_ID, spotId: spot.id }, { outOfService: true });

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'LOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it('refuses an app token, sent as a bearer or inside the dashboard cookie', async () => {
    const spot = parkingDemoSpotA3();
    const url = servicePathOf(PARKING_DEMO_ID, spot.id);
    const bearer = await authorizationFor(drivers, sophie, 'sophie-app-token');

    const asBearer = await server.inject({ method: 'PUT', url, headers: { ...writeHeader, ...bearer }, payload: { outOfService: true } });
    const asCookie = await server.inject({ method: 'PUT', url, cookies: { [DASHBOARD_COOKIE]: 'sophie-app-token' }, headers: writeHeader, payload: { outOfService: true } });

    expect(asBearer.statusCode).toBe(401);
    expect(asCookie.statusCode).toBe(401);
    expect(spot.state).toBe('AVAILABLE');
  });

  it.each([
    ['the value another library sends', { 'x-requested-with': 'XMLHttpRequest' }],
    ['the value in another case', { 'x-requested-with': 'Palier-Dashboard' }],
    ['absent on a simple cross-site content type', { 'content-type': 'text/plain' }],
  ])('refuses a write whose dashboard header is %s', async (_kind, headers) => {
    const spot = parkingDemoSpotA3();
    const cookies = await dashboardCookieFor(server, sophie);

    const forged = await server.inject({ method: 'PUT', url: servicePathOf(PARKING_DEMO_ID, spot.id), cookies, headers, payload: JSON.stringify({ outOfService: true }) });

    expect(forged.statusCode).toBe(403);
    expect(forged.json()).toMatchObject({ error: 'CSRF_HEADER_MISSING' });
    expect(spot.state).toBe('AVAILABLE');
  });

  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)('has no %s on the service path, so no simple request reaches the toggle', async (method) => {
    const spot = parkingDemoSpotA3();
    const before = structuredClone(spots.spots);
    const cookies = await dashboardCookieFor(server, sophie);

    const answer = await server.inject({ method, url: servicePathOf(PARKING_DEMO_ID, spot.id), cookies, headers: writeHeader });

    expect(answer.statusCode).toBe(404);
    expect(spots.spots).toEqual(before);
  });

  it.each([
    ['an array', { outOfService: [true] }],
    ['an object', { outOfService: { value: true } }],
    ['zero', { outOfService: 0 }],
    ['the string false', { outOfService: 'false' }],
    ['a body that is a list', [{ outOfService: true }]],
    ['a key in another case', { OutOfService: true }],
  ])('refuses outOfService given as %s, in both starting states', async (_kind, payload) => {
    const spot = parkingDemoSpotA3();
    const cookies = await dashboardCookieFor(server, sophie);
    const place = { lotId: PARKING_DEMO_ID, spotId: spot.id };

    const onFreeSpot = await setService(cookies, place, payload);
    spot.state = 'OUT_OF_SERVICE';
    const onBlockedSpot = await setService(cookies, place, payload);

    expect(onFreeSpot.statusCode).toBe(400);
    expect(onBlockedSpot.statusCode).toBe(400);
    expect(spot.state).toBe('OUT_OF_SERVICE');
  });

  it.each([true, false])('answers a retired spot not found and leaves it retired (outOfService %s)', async (outOfService) => {
    const spot = parkingDemoSpotA3();
    Object.assign(spot, { retired: true, hasHistory: true, state: 'OUT_OF_SERVICE' });
    const before = structuredClone(spots.spots);

    const answer = await setService(await dashboardCookieFor(server, sophie), { lotId: PARKING_DEMO_ID, spotId: spot.id }, { outOfService });

    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toMatchObject({ error: 'SPOT_NOT_FOUND' });
    expect(spots.spots).toEqual(before);
  });

  it('names no lot, spot or operator in a refusal', async () => {
    const spot = parkingDemoSpotA3();
    spot.state = 'OCCUPIED';
    const sophieCookies = await dashboardCookieFor(server, sophie);
    const place = { lotId: PARKING_DEMO_ID, spotId: spot.id };

    const refusals = [
      await setService(await dashboardCookieFor(server, pierre), place, { outOfService: true }),
      await setService(sophieCookies, { ...place, spotId: randomUUID() }, { outOfService: true }),
      await setService(sophieCookies, place, { outOfService: true }),
    ];

    expect(refusals.map(({ statusCode }) => statusCode)).toEqual([404, 404, 409]);
    for (const { body } of refusals) {
      expect(body).not.toContain(spot.id);
      expect(body).not.toContain(PARKING_DEMO_ID);
      expect(body).not.toMatch(/A-3|Démo|Lavoie/);
    }
  });
});

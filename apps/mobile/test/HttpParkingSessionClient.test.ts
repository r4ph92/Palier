import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { HttpParkingSessionClient } from '../src/api/HttpParkingSessionClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { julieAtParkingDemo } from './fakeParkingSessionClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';

function clientAnswering(body: unknown, status = 200, onUnauthorized = () => undefined) {
  const fetchFunction = jest.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  const client = new HttpParkingSessionClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized, onConsentRequired: () => undefined, fetchFunction });
  return { client, fetchFunction };
}

describe('HttpParkingSessionClient', () => {
  it("reads the driver's current session with the bearer token", async () => {
    const { client, fetchFunction } = clientAnswering({ session: julieAtParkingDemo() });

    await expect(client.current()).resolves.toEqual(julieAtParkingDemo());
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/session`,
      expect.objectContaining({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('reads a session presumed parked (story #18)', async () => {
    const parked = julieAtParkingDemo({ state: 'PARKED_PRESUMED' });

    await expect(clientAnswering({ session: parked }).client.current()).resolves.toEqual(parked);
  });

  it('answers null when the driver has no session', async () => {
    await expect(clientAnswering({ session: null }).client.current()).resolves.toBeNull();
  });

  it.each([
    ['no session field', {}],
    ['a cancelled session', { session: julieAtParkingDemo({ state: 'CANCELLED' as never }) }],
    ['an amount given as text', { session: { ...julieAtParkingDemo(), amountCents: '975' } }],
    ['an entry time that is not a date', { session: julieAtParkingDemo({ enteredAt: 'hier' }) }],
  ])('treats %s as Palier being unreachable', async (_case, body) => {
    await expect(clientAnswering(body).client.current()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it.each([
    ['a plan whose aisle has a text minor', { levelCode: 'P1', aisles: [{ code: 'A', beaconMinor: '1', rectangle: null }] }],
    ['a plan with a negative width', { levelCode: 'P1', aisles: [{ code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: -1, height: 4 } }] }],
    ['a plan with a negative x', { levelCode: 'P1', aisles: [{ code: 'A', beaconMinor: 1, rectangle: { x: -1, y: 0, width: 4, height: 4 } }] }],
    ['a plan that is not an object', 'P1'],
  ])('keeps the session but drops %s', async (_case, levelPlan) => {
    const { client } = clientAnswering({ session: { ...julieAtParkingDemo(), levelPlan } });

    await expect(client.current()).resolves.toEqual(julieAtParkingDemo({ levelPlan: null }));
  });

  it('reads a session from an API older than the plan as one without beacons or plan', async () => {
    const olderSession: Record<string, unknown> = { ...julieAtParkingDemo() };
    delete olderSession['beaconMajor'];
    delete olderSession['levelPlan'];

    await expect(clientAnswering({ session: olderSession }).client.current()).resolves.toEqual(
      julieAtParkingDemo({ beaconMajor: null, levelPlan: null }),
    );
  });

  it('signs the driver out on a 401', async () => {
    const onUnauthorized = jest.fn();

    await expect(clientAnswering({}, 401, onUnauthorized).client.current()).rejects.toBeInstanceOf(PalierUnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('reports a 500 as a status error', async () => {
    await expect(clientAnswering({}, 500).client.current()).rejects.toBeInstanceOf(PalierStatusError);
  });
});

const WALKED_AT = new Date('2026-11-04T23:05:00.000Z');
const PRESUMED = { state: 'PARKED_PRESUMED', parkedAt: WALKED_AT.toISOString() };

describe('HttpParkingSessionClient, reporting the walk away from the car (story #18)', () => {
  it('posts the walking instant for the session with the bearer token', async () => {
    const { client, fetchFunction } = clientAnswering(PRESUMED);

    await expect(client.reportParked('session-1', WALKED_AT.getTime())).resolves.toEqual(PRESUMED);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries/session-1/parked`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ detectedAt: WALKED_AT.toISOString() }),
      }),
    );
  });

  it('escapes the session id in the path', async () => {
    const { client, fetchFunction } = clientAnswering(PRESUMED);

    await client.reportParked('../me', WALKED_AT.getTime());

    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/entries/..%2Fme/parked`, expect.anything());
  });

  it.each([
    [409, 'ENTRY_NOT_CONFIRMED'],
    [409, 'SESSION_CLOSED'],
    [404, 'SESSION_NOT_FOUND'],
  ])('turns a %i %s into a rejection carrying the code', async (status, error) => {
    const { client } = clientAnswering({ statusCode: status, error, message: 'refused' }, status);

    await expect(client.reportParked('session-1', WALKED_AT.getTime())).rejects.toEqual(new PalierRejectedError(error));
  });

  it.each([
    ['another state', { ...PRESUMED, state: 'ENTRY_CONFIRMED' }],
    ['an instant that is not a date', { ...PRESUMED, parkedAt: 'hier' }],
  ])('treats an answer with %s as Palier being unreachable', async (_case, body) => {
    await expect(clientAnswering(body).client.reportParked('session-1', WALKED_AT.getTime())).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('reports a 500 as a status error', async () => {
    await expect(clientAnswering({}, 500).client.reportParked('session-1', WALKED_AT.getTime())).rejects.toBeInstanceOf(PalierStatusError);
  });
});

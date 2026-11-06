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

  it('reads the question of a session asked where it parked (story #21)', async () => {
    const asked = julieAtParkingDemo({ state: 'PARKED_UNCONFIRMED', question: { aisleCode: 'B', freeSpotNumbers: ['B-1', 'B-3'] } });

    await expect(clientAnswering({ session: asked }).client.current()).resolves.toEqual(asked);
  });

  it.each([
    ['a question whose numbers are not text', { aisleCode: 'B', freeSpotNumbers: [3] }],
    ['a question without its aisle', { freeSpotNumbers: ['B-3'] }],
    ['no question field, from an older API', undefined],
  ])('keeps the session but reads %s as no question', async (_case, question) => {
    const { client } = clientAnswering({ session: { ...julieAtParkingDemo({ state: 'PARKED_UNCONFIRMED' }), question } });

    await expect(client.current()).resolves.toEqual(julieAtParkingDemo({ state: 'PARKED_UNCONFIRMED', question: null }));
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
const WALK = { detectedAt: WALKED_AT.getTime(), aisleMinor: null };

describe('HttpParkingSessionClient, reporting the walk away from the car (story #18)', () => {
  it('posts the walking instant for the session with the bearer token', async () => {
    const { client, fetchFunction } = clientAnswering(PRESUMED);

    await expect(client.reportParked('session-1', WALK)).resolves.toEqual(PRESUMED);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries/session-1/parked`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ detectedAt: WALKED_AT.toISOString() }),
      }),
    );
  });

  it('sends the aisle the device last saw, and reads the question that follows (story #21)', async () => {
    const unconfirmed = { state: 'PARKED_UNCONFIRMED', parkedAt: WALKED_AT.toISOString() };
    const { client, fetchFunction } = clientAnswering(unconfirmed);

    await expect(client.reportParked('session-1', { ...WALK, aisleMinor: 2 })).resolves.toEqual(unconfirmed);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries/session-1/parked`,
      expect.objectContaining({ body: JSON.stringify({ detectedAt: WALKED_AT.toISOString(), detectedAisleMinor: 2 }) }),
    );
  });

  it('reads an earlier walk already answered as accepted (story #21)', async () => {
    const confirmed = { state: 'PARKED_CONFIRMED', parkedAt: WALKED_AT.toISOString() };

    await expect(clientAnswering(confirmed).client.reportParked('session-1', WALK)).resolves.toEqual(confirmed);
  });

  it('escapes the session id in the path', async () => {
    const { client, fetchFunction } = clientAnswering(PRESUMED);

    await client.reportParked('../me', WALK);

    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/entries/..%2Fme/parked`, expect.anything());
  });

  it.each([
    [409, 'ENTRY_NOT_CONFIRMED'],
    [409, 'SESSION_CLOSED'],
    [404, 'SESSION_NOT_FOUND'],
  ])('turns a %i %s into a rejection carrying the code', async (status, error) => {
    const { client } = clientAnswering({ statusCode: status, error, message: 'refused' }, status);

    await expect(client.reportParked('session-1', WALK)).rejects.toEqual(new PalierRejectedError(error));
  });

  it.each([
    ['another state', { ...PRESUMED, state: 'ENTRY_CONFIRMED' }],
    ['an instant that is not a date', { ...PRESUMED, parkedAt: 'hier' }],
  ])('treats an answer with %s as Palier being unreachable', async (_case, body) => {
    await expect(clientAnswering(body).client.reportParked('session-1', WALK)).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('reports a 500 as a status error', async () => {
    await expect(clientAnswering({}, 500).client.reportParked('session-1', WALK)).rejects.toBeInstanceOf(PalierStatusError);
  });
});

describe('HttpParkingSessionClient, answering where the car is (story #21)', () => {
  const CONFIRMED = { state: 'PARKED_CONFIRMED', spot: { number: 'B-3', levelCode: 'P1', aisleCode: 'B' } };

  it('posts the typed number for the session with the bearer token', async () => {
    const { client, fetchFunction } = clientAnswering(CONFIRMED);

    await expect(client.answerParkedSpot('session-1', 'b3')).resolves.toEqual(CONFIRMED);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries/session-1/spot`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ spotNumber: 'b3' }),
      }),
    );
  });

  it.each([
    [409, 'UNKNOWN_SPOT'],
    [409, 'SPOT_TAKEN'],
    [404, 'SESSION_NOT_FOUND'],
  ])('turns a %i %s into a rejection carrying the code', async (status, error) => {
    const { client } = clientAnswering({ statusCode: status, error, message: 'refused' }, status);

    await expect(client.answerParkedSpot('session-1', 'B-3')).rejects.toEqual(new PalierRejectedError(error));
  });

  it('reports the 400 FST_ERR_VALIDATION of the schema check by its status', async () => {
    const answer = clientAnswering({ statusCode: 400, code: 'FST_ERR_VALIDATION', error: 'Bad Request', message: 'body/spotNumber' }, 400).client.answerParkedSpot('session-1', 'B-3');

    await expect(answer).rejects.toEqual(new PalierStatusError(400));
  });

  it('reports a 503 LOT_BUSY as a status error', async () => {
    await expect(clientAnswering({ error: 'LOT_BUSY' }, 503).client.answerParkedSpot('session-1', 'B-3')).rejects.toBeInstanceOf(PalierStatusError);
  });

  it.each([
    ['another state', { ...CONFIRMED, state: 'PARKED_PRESUMED' }],
    ['no spot', { state: 'PARKED_CONFIRMED' }],
  ])('treats an answer with %s as Palier being unreachable', async (_case, body) => {
    await expect(clientAnswering(body).client.answerParkedSpot('session-1', 'B-3')).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

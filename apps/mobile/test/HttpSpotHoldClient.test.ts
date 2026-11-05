import type { SpotHold } from '@palier/shared-types';
import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { HttpSpotHoldClient } from '../src/api/HttpSpotHoldClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';
import { PARKING_DEMO_ID } from './fakeLotsClient';
import { julieHoldAtParkingDemo } from './fakeSpotHoldClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';

function clientAnswering(body: unknown, status = 200, callbacks = { onUnauthorized: jest.fn(), onConsentRequired: jest.fn() }) {
  const fetchFunction = jest.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  const client = new HttpSpotHoldClient({ baseUrl: BASE_URL, token: TOKEN, ...callbacks, fetchFunction });
  return { client, fetchFunction, ...callbacks };
}

describe('HttpSpotHoldClient', () => {
  it('asks Palier to hold a spot in the lot with the bearer token', async () => {
    const { client, fetchFunction } = clientAnswering(julieHoldAtParkingDemo(), 201);

    await expect(client.hold(PARKING_DEMO_ID)).resolves.toEqual(julieHoldAtParkingDemo());
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/lots/${PARKING_DEMO_ID}/holds`,
      expect.objectContaining({ method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('keeps only the fields it knows from an answer', async () => {
    const { client } = clientAnswering({ ...julieHoldAtParkingDemo(), spotNumber: 'A-1' }, 201);

    expect(await client.hold(PARKING_DEMO_ID)).toEqual(julieHoldAtParkingDemo());
  });

  it.each([
    ['HOLD_ALREADY_EXISTS', 409],
    ['HOLD_QUOTA_REACHED', 409],
    ['LOT_NOT_FOUND', 404],
    ['TOO_MANY_HOLD_ATTEMPTS', 429],
    ['HOLD_UNAVAILABLE', 503],
  ])('reports %s as a refusal with its code', async (code, status) => {
    const { client } = clientAnswering({ statusCode: status, error: code, message: 'refused' }, status);

    await expect(client.hold(PARKING_DEMO_ID)).rejects.toEqual(new PalierRejectedError(code));
  });

  it('shows the notice again on a 403 CONSENT_REQUIRED', async () => {
    const { client, onConsentRequired } = clientAnswering({ statusCode: 403, error: 'CONSENT_REQUIRED' }, 403);

    await expect(client.hold(PARKING_DEMO_ID)).rejects.toBeInstanceOf(PalierConsentRequiredError);
    expect(onConsentRequired).toHaveBeenCalled();
  });

  it('signs the driver out on a 401', async () => {
    const { client, onUnauthorized } = clientAnswering({}, 401);

    await expect(client.hold(PARKING_DEMO_ID)).rejects.toBeInstanceOf(PalierUnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('reports a 500 as a status error', async () => {
    await expect(clientAnswering({}, 500).client.hold(PARKING_DEMO_ID)).rejects.toBeInstanceOf(PalierStatusError);
  });

  it.each([
    ['no hold id', { ...julieHoldAtParkingDemo(), spotHoldId: undefined }],
    ['an end that is not a date', { ...julieHoldAtParkingDemo(), expiresAt: 'bientôt' }],
    ['no server time', { ...julieHoldAtParkingDemo(), now: undefined }],
  ])('treats an answer with %s as Palier being unreachable', async (_case, body: Record<keyof SpotHold, unknown>) => {
    await expect(clientAnswering(body, 201).client.hold(PARKING_DEMO_ID)).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it("reads the driver's current hold", async () => {
    const { client, fetchFunction } = clientAnswering({ spotHold: julieHoldAtParkingDemo() });

    await expect(client.current()).resolves.toEqual(julieHoldAtParkingDemo());
    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/me/hold`, expect.objectContaining({ method: 'GET' }));
  });

  it('answers null when the driver holds no spot', async () => {
    await expect(clientAnswering({ spotHold: null }).client.current()).resolves.toBeNull();
  });

  it('treats a current hold answer without its field as Palier being unreachable', async () => {
    await expect(clientAnswering({}).client.current()).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

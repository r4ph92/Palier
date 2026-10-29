import { HttpVehicleClient } from '../src/api/HttpVehicleClient';
import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';
const abc123 = { id: 'vehicle-1', plate: 'ABC 123', province: 'QC' };

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function clientAnswering(response: Promise<Response>, callbacks: { onUnauthorized?: () => void; onConsentRequired?: () => void } = {}) {
  return new HttpVehicleClient({
    baseUrl: BASE_URL,
    token: TOKEN,
    onUnauthorized: callbacks.onUnauthorized ?? (() => undefined),
    onConsentRequired: callbacks.onConsentRequired ?? (() => undefined),
    fetchFunction: () => response,
  });
}

describe('HttpVehicleClient', () => {
  it('lists the vehicles of GET /v1/vehicles with the bearer token', async () => {
    const fetchFunction = jest.fn(() => jsonResponse([abc123]));
    const client = new HttpVehicleClient({
      baseUrl: BASE_URL,
      token: TOKEN,
      onUnauthorized: () => undefined,
      onConsentRequired: () => undefined,
      fetchFunction,
    });

    await expect(client.listVehicles()).resolves.toEqual([abc123]);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/vehicles`,
      expect.objectContaining({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('posts the plate and province and returns the saved vehicle', async () => {
    const fetchFunction = jest.fn(() => jsonResponse(abc123, 201));
    const client = new HttpVehicleClient({
      baseUrl: BASE_URL,
      token: TOKEN,
      onUnauthorized: () => undefined,
      onConsentRequired: () => undefined,
      fetchFunction,
    });

    await expect(client.addVehicle({ plate: 'abc 123', province: 'QC' })).resolves.toEqual(abc123);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/vehicles`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ plate: 'abc 123', province: 'QC' }) }),
    );
  });

  it('reports a refused plate with the API reason', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'INVALID_PLATE' }, 400)).addVehicle({ plate: '', province: 'QC' });

    await expect(failure).rejects.toBeInstanceOf(PalierRejectedError);
    await expect(failure).rejects.toMatchObject({ code: 'INVALID_PLATE' });
  });

  it('reports a duplicate vehicle with its reason', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'VEHICLE_ALREADY_REGISTERED' }, 409)).addVehicle({ plate: 'ABC123', province: 'QC' });

    await expect(failure).rejects.toMatchObject({ code: 'VEHICLE_ALREADY_REGISTERED' });
  });

  it('reports a missing privacy notice as consent required, and tells the app', async () => {
    const onConsentRequired = jest.fn();
    const failure = clientAnswering(jsonResponse({ error: 'CONSENT_REQUIRED' }, 403), { onConsentRequired }).listVehicles();

    await expect(failure).rejects.toBeInstanceOf(PalierConsentRequiredError);
    expect(onConsentRequired).toHaveBeenCalledTimes(1);
  });

  it('reports other forbidden answers as a status error', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'Forbidden' }, 403)).listVehicles();

    await expect(failure).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('ends the session when the token is refused', async () => {
    const onUnauthorized = jest.fn();
    const failure = clientAnswering(jsonResponse({}, 401), { onUnauthorized }).listVehicles();

    await expect(failure).rejects.toBeInstanceOf(PalierUnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('treats a network failure as unreachable', async () => {
    const client = clientAnswering(Promise.reject(new TypeError('Network request failed')));

    await expect(client.listVehicles()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('treats a vehicle of the wrong shape as unreachable', async () => {
    const client = clientAnswering(jsonResponse({ id: 'vehicle-1', plate: 'ABC 123' }, 201));

    await expect(client.addVehicle({ plate: 'ABC 123', province: 'QC' })).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

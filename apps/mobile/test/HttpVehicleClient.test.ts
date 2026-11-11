import { HttpVehicleClient } from '../src/api/HttpVehicleClient';
import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';
const noNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const abc123 = { id: 'vehicle-1', plate: 'ABC 123', province: 'QC', isDefault: true, transponder: null, isElectric: false, hasAccessiblePermit: false, isOversize: false };

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
  it('lists the vehicles of GET /v1/me/vehicles with the bearer token', async () => {
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
      `${BASE_URL}/v1/me/vehicles`,
      expect.objectContaining({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('treats a vehicle without its needs as an unexpected answer', async () => {
    const withoutOversize: Partial<typeof abc123> = { ...abc123 };
    delete withoutOversize.isOversize;

    await expect(clientAnswering(jsonResponse([withoutOversize])).listVehicles()).rejects.toBeInstanceOf(PalierUnreachableError);
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

    await expect(client.addVehicle({ plate: 'abc 123', province: 'QC', ...noNeeds })).resolves.toEqual(abc123);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/vehicles`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ plate: 'abc 123', province: 'QC', ...noNeeds }) }),
    );
  });

  it('patches the needs and the transponder of a vehicle and returns the saved vehicle', async () => {
    const needs = { isElectric: true, hasAccessiblePermit: true, isOversize: false };
    const fetchFunction = jest.fn(() => jsonResponse({ ...abc123, ...needs }));
    const client = new HttpVehicleClient({
      baseUrl: BASE_URL,
      token: TOKEN,
      onUnauthorized: () => undefined,
      onConsentRequired: () => undefined,
      fetchFunction,
    });

    await expect(client.updateVehicleNeeds(abc123.id, { ...needs, transponder: 't-0042' })).resolves.toEqual({ ...abc123, ...needs });
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/vehicles/${abc123.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ ...needs, transponder: 't-0042' }) }),
    );
  });

  it('reports a refused plate with the API reason', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'INVALID_PLATE' }, 400)).addVehicle({ plate: '', province: 'QC', ...noNeeds });

    await expect(failure).rejects.toBeInstanceOf(PalierRejectedError);
    await expect(failure).rejects.toMatchObject({ code: 'INVALID_PLATE' });
  });

  it('reports a duplicate vehicle with its reason', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'VEHICLE_ALREADY_REGISTERED' }, 409)).addVehicle({ plate: 'ABC123', province: 'QC', ...noNeeds });

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

  it('makes a vehicle the default with POST /v1/me/vehicles/:id/default and returns it', async () => {
    const chosen = { ...abc123, id: 'vehicle-2', isDefault: true };
    const fetchFunction = jest.fn(() => jsonResponse(chosen));
    const client = new HttpVehicleClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized: () => undefined, onConsentRequired: () => undefined, fetchFunction });

    await expect(client.setDefaultVehicle('vehicle-2')).resolves.toEqual(chosen);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/vehicles/vehicle-2/default`,
      expect.objectContaining({ method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('deletes a vehicle with DELETE /v1/me/vehicles/:id and resolves without a body', async () => {
    const fetchFunction = jest.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = new HttpVehicleClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized: () => undefined, onConsentRequired: () => undefined, fetchFunction });

    await expect(client.deleteVehicle('vehicle-1')).resolves.toBeUndefined();
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/vehicles/vehicle-1`,
      expect.objectContaining({ method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('reports the last vehicle refusal with its reason', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'LAST_VEHICLE' }, 409)).deleteVehicle('vehicle-1');

    await expect(failure).rejects.toMatchObject({ code: 'LAST_VEHICLE' });
  });

  it('treats a vehicle of the wrong shape as unreachable', async () => {
    const client = clientAnswering(jsonResponse({ id: 'vehicle-1', plate: 'ABC 123' }, 201));

    await expect(client.addVehicle({ plate: 'ABC 123', province: 'QC', ...noNeeds })).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

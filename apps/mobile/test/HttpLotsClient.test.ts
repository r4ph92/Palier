import { HttpLotsClient } from '../src/api/HttpLotsClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { parkingDemo as parkingDemoWithFreeSpots } from './fakeLotsClient';

const BASE_URL = 'http://localhost:3000';
const parkingDemo = parkingDemoWithFreeSpots(10);

function clientAnswering(response: Promise<Response>, timeoutMilliseconds = 8000): HttpLotsClient {
  return new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction: () => response, timeoutMilliseconds });
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('HttpLotsClient', () => {
  it('returns the lots of GET /v1/lots', async () => {
    const fetchFunction = jest.fn(() => jsonResponse([parkingDemo]));
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction });

    await expect(client.listLots()).resolves.toEqual([parkingDemo]);
    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/lots`, expect.anything());
  });

  it('treats a network failure as unreachable and keeps its cause', async () => {
    const networkFailure = new TypeError('Network request failed');
    const client = clientAnswering(Promise.reject(networkFailure));

    await expect(client.listLots()).rejects.toMatchObject({ name: 'PalierUnreachableError', cause: networkFailure });
  });

  it('reports a non-2xx answer as a status error carrying the status', async () => {
    const failure = clientAnswering(jsonResponse({}, 503)).listLots();

    await expect(failure).rejects.toBeInstanceOf(PalierStatusError);
    await expect(failure).rejects.toMatchObject({ status: 503 });
  });

  it('treats a body that is not JSON as unreachable', async () => {
    const response = Promise.resolve(new Response('<html>proxy</html>', { status: 200 }));

    await expect(clientAnswering(response).listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('treats a body of the wrong shape as unreachable', async () => {
    const wrongShape = jsonResponse([{ id: 'lot-1', name: 'Parking Démo' }]);

    await expect(clientAnswering(wrongShape).listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('accepts a lot without a location', async () => {
    const withoutLocation = { ...parkingDemo, location: null };

    await expect(clientAnswering(jsonResponse([withoutLocation])).listLots()).resolves.toEqual([withoutLocation]);
  });

  it.each([
    ['a missing category count', { ...parkingDemo, freeSpotsByCategory: { standard: 7, electric: 1, accessible: 1 } }],
    ['a category count that is not an integer', { ...parkingDemo, freeSpotsByCategory: { ...parkingDemo.freeSpotsByCategory, oversize: '1' } }],
    ['a missing location', { id: parkingDemo.id, name: parkingDemo.name, freeSpots: 10, freeSpotsByCategory: parkingDemo.freeSpotsByCategory }],
    ['a location without longitude', { ...parkingDemo, location: { latitude: 45.5 } }],
    ['a latitude that is not a number', { ...parkingDemo, location: { latitude: '45.5', longitude: -73.5 } }],
  ])('treats a lot with %s as unreachable', async (_case, lot) => {
    await expect(clientAnswering(jsonResponse([lot])).listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('gives up after the timeout', async () => {
    const neverAnswers = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction: neverAnswers, timeoutMilliseconds: 10 });

    await expect(client.listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('sends the driver token as a bearer token', async () => {
    const fetchFunction = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(() => jsonResponse([parkingDemo]));
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction, token: 'julie-token' });

    await client.listLots();

    expect(fetchFunction.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer julie-token' });
  });

  it('reports a 401 to onUnauthorized and still fails the request', async () => {
    const onUnauthorized = jest.fn();
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction: () => jsonResponse({}, 401), onUnauthorized });

    await expect(client.listLots()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnauthorized for other failures', async () => {
    const onUnauthorized = jest.fn();
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction: () => jsonResponse({}, 503), onUnauthorized });

    await expect(client.listLots()).rejects.toBeInstanceOf(PalierStatusError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

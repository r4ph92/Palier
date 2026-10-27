import { HttpLotsClient } from '../src/api/HttpLotsClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';

const BASE_URL = 'http://localhost:3000';
const parkingDemo = { id: 'lot-1', name: 'Parking Démo', freeSpots: 10 };

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

  it('gives up after the timeout', async () => {
    const neverAnswers = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = new HttpLotsClient({ baseUrl: BASE_URL, fetchFunction: neverAnswers, timeoutMilliseconds: 10 });

    await expect(client.listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

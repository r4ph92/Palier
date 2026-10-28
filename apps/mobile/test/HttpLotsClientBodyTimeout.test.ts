import { HttpLotsClient } from '../src/api/HttpLotsClient';
import { PalierUnreachableError } from '../src/api/LotsClient';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT_MILLISECONDS = 10;
const OBSERVATION_WINDOW_MILLISECONDS = 300;
const STILL_PENDING = 'still pending after the timeout';

function headersThenStalledBody(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const stalledBody = new Promise<unknown>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
  return Promise.resolve({ ok: true, status: 200, json: () => stalledBody } as unknown as Response);
}

function settleWithin(promise: Promise<unknown>, milliseconds: number): Promise<unknown> {
  const pending = new Promise((resolve) => setTimeout(() => resolve(STILL_PENDING), milliseconds));
  return Promise.race([promise.then((value) => value, (error: unknown) => error), pending]);
}

describe('HttpLotsClient body timeout', () => {
  it('gives up when the server sends headers and then stalls the body', async () => {
    const client = new HttpLotsClient({
      baseUrl: BASE_URL,
      fetchFunction: headersThenStalledBody,
      timeoutMilliseconds: TIMEOUT_MILLISECONDS,
    });

    const outcome = await settleWithin(client.listLots(), OBSERVATION_WINDOW_MILLISECONDS);

    expect(outcome).toBeInstanceOf(PalierUnreachableError);
  });
});

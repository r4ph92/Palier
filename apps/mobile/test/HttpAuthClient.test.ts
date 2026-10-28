import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { HttpAuthClient } from '../src/api/HttpAuthClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';

const BASE_URL = 'http://localhost:3000';
const julie = { id: 'driver-1', firstName: 'Julie' };

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function clientRecording(response: () => Promise<Response>) {
  const fetchFunction = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(response);
  return { client: new HttpAuthClient({ baseUrl: BASE_URL, fetchFunction }), fetchFunction };
}

describe('HttpAuthClient', () => {
  it('lists the test drivers', async () => {
    const drivers = [{ ...julie, lastName: 'Tremblay' }];
    const { client, fetchFunction } = clientRecording(() => jsonResponse(drivers));

    await expect(client.listTestDrivers()).resolves.toEqual(drivers);
    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/test/drivers`);
  });

  it('posts the chosen driver id to sign in, and returns the token and driver', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ token: 'julie-token', driver: julie }));

    await expect(client.signInAsTestDriver('driver-1')).resolves.toEqual({ token: 'julie-token', driver: julie });
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ driverId: 'driver-1' }) });
  });

  it('sends the token as a bearer token to read the profile', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ ...julie, acceptedNoticeVersion: null }));

    await expect(client.fetchMe('julie-token')).resolves.toEqual({ ...julie, acceptedNoticeVersion: null });
    expect(fetchFunction.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer julie-token' });
  });

  it('posts the accepted notice version with the token', async () => {
    const { client, fetchFunction } = clientRecording(() => Promise.resolve(new Response(null, { status: 204 })));

    await client.acceptNotice('julie-token', '2026-10-28');

    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/consent`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer julie-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeVersion: '2026-10-28' }),
    });
  });

  it('treats a profile without the notice field as unreachable', async () => {
    const { client } = clientRecording(() => jsonResponse(julie));

    await expect(client.fetchMe('julie-token')).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('posts the token to sign out', async () => {
    const { client, fetchFunction } = clientRecording(() => Promise.resolve(new Response(null, { status: 204 })));

    await client.signOut('julie-token');

    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/sign-out`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer julie-token' } });
  });

  it('reports a refused token as unauthorized', async () => {
    const { client } = clientRecording(() => jsonResponse({}, 401));

    await expect(client.fetchMe('old-token')).rejects.toBeInstanceOf(PalierUnauthorizedError);
  });

  it('reports other failures as a status error', async () => {
    const { client } = clientRecording(() => jsonResponse({}, 404));

    await expect(client.listTestDrivers()).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('treats a network failure as unreachable', async () => {
    const { client } = clientRecording(() => Promise.reject(new TypeError('Network request failed')));

    await expect(client.fetchMe('julie-token')).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('treats a body of the wrong shape as unreachable', async () => {
    const { client } = clientRecording(() => jsonResponse({ token: 'julie-token' }));

    await expect(client.signInAsTestDriver('driver-1')).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

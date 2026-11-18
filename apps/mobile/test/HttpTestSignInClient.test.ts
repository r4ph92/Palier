import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { HttpTestSignInClient } from '../src/testSignIn/HttpTestSignInClient';

const BASE_URL = 'http://localhost:3000';
const julie = { id: 'driver-1', firstName: 'Julie' };

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function clientRecording(response: () => Promise<Response>) {
  const fetchFunction = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(response);
  return { client: new HttpTestSignInClient({ baseUrl: BASE_URL, fetchFunction }), fetchFunction };
}

describe('HttpTestSignInClient', () => {
  it('lists the test drivers', async () => {
    const drivers = [{ ...julie, lastName: 'Tremblay' }];
    const { client, fetchFunction } = clientRecording(() => jsonResponse(drivers));

    await expect(client.listTestDrivers()).resolves.toEqual(drivers);
    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/test/drivers`);
  });

  it('posts the chosen driver id to sign in, and returns the token and driver', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ token: 'julie-token', driver: julie }));

    await expect(client.signInAsTestDriver('driver-1')).resolves.toEqual({ token: 'julie-token', driver: julie });
    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/test/sign-in`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ driverId: 'driver-1' }) });
  });

  it('reports a refusal as a status error', async () => {
    const { client } = clientRecording(() => jsonResponse({}, 404));

    await expect(client.listTestDrivers()).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('treats a body of the wrong shape as unreachable', async () => {
    const { client } = clientRecording(() => jsonResponse({ token: 'julie-token' }));

    await expect(client.signInAsTestDriver('driver-1')).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

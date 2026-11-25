import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
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
  it('sends the token as a bearer token to read the profile', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ ...julie, acceptedNoticeVersion: null }));

    await expect(client.fetchMe('julie-token')).resolves.toEqual({ ...julie, acceptedNoticeVersion: null });
    expect(fetchFunction.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer julie-token' });
  });

  it('posts the accepted notice version with the token', async () => {
    const { client, fetchFunction } = clientRecording(() => Promise.resolve(new Response(null, { status: 204 })));

    await client.acceptNotice('julie-token', PRIVACY_NOTICE_VERSION);

    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/consent`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer julie-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeVersion: PRIVACY_NOTICE_VERSION }),
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

  it('posts the Apple identity token, with the name Apple gave, and answers the Palier token', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ token: 'palier-token', driver: julie }));

    await expect(client.signInWithApple({ identityToken: 'apple-jwt', firstName: 'Julie', lastName: 'Tremblay' })).resolves.toBe('palier-token');
    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/sign-in/apple`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'apple-jwt', firstName: 'Julie', lastName: 'Tremblay' }),
    });
  });

  it('leaves out the name Apple did not give', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ token: 'palier-token', driver: julie }));

    await client.signInWithApple({ identityToken: 'apple-jwt', firstName: null, lastName: null });

    expect(fetchFunction.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ identityToken: 'apple-jwt' }));
  });

  it('posts the Google identity token and answers the Palier token', async () => {
    const { client, fetchFunction } = clientRecording(() => jsonResponse({ token: 'palier-token', driver: julie }));

    await expect(client.signInWithGoogle('google-jwt')).resolves.toBe('palier-token');
    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/sign-in/google`);
    expect(fetchFunction.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ identityToken: 'google-jwt' }));
  });

  it('reports an identity token the API refuses as unauthorized', async () => {
    const { client } = clientRecording(() => jsonResponse({ error: 'Unauthorized' }, 401));

    await expect(client.signInWithGoogle('forged')).rejects.toBeInstanceOf(PalierUnauthorizedError);
  });

  it('treats a sign-in answer without a token as unreachable', async () => {
    const { client } = clientRecording(() => jsonResponse({ driver: julie }));

    await expect(client.signInWithGoogle('google-jwt')).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('puts the name with the token', async () => {
    const { client, fetchFunction } = clientRecording(() => Promise.resolve(new Response(null, { status: 204 })));

    await client.saveName('julie-token', 'Julie', 'Tremblay');

    expect(fetchFunction.mock.calls[0]?.[0]).toBe(`${BASE_URL}/v1/me/name`);
    expect(fetchFunction.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      headers: { Authorization: 'Bearer julie-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Julie', lastName: 'Tremblay' }),
    });
  });

  it('reports a refused token as unauthorized', async () => {
    const { client } = clientRecording(() => jsonResponse({}, 401));

    await expect(client.fetchMe('old-token')).rejects.toBeInstanceOf(PalierUnauthorizedError);
  });

  it('reports other failures as a status error', async () => {
    const { client } = clientRecording(() => jsonResponse({}, 404));

    await expect(client.fetchMe('julie-token')).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('treats a network failure as unreachable', async () => {
    const { client } = clientRecording(() => Promise.reject(new TypeError('Network request failed')));

    await expect(client.fetchMe('julie-token')).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('treats a body of the wrong shape as unreachable', async () => {
    const { client } = clientRecording(() => jsonResponse({ id: 'driver-1' }));

    await expect(client.fetchMe('julie-token')).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

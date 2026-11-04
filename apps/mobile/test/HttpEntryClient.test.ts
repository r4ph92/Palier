import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { HttpEntryClient } from '../src/api/HttpEntryClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';
import { ENTREE_DEMO_QR, spotA1 } from './fakeEntryClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';
const entered = { sessionId: 'session-1', spot: spotA1, barrierOpened: true };

function jsonResponse(body: unknown, status = 201): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function clientAnswering(response: Promise<Response>, callbacks: { onUnauthorized?: () => void; onConsentRequired?: () => void } = {}) {
  const fetchFunction = jest.fn(() => response);
  const client = new HttpEntryClient({
    baseUrl: BASE_URL,
    token: TOKEN,
    onUnauthorized: callbacks.onUnauthorized ?? (() => undefined),
    onConsentRequired: callbacks.onConsentRequired ?? (() => undefined),
    fetchFunction,
  });
  return { client, fetchFunction };
}

describe('HttpEntryClient', () => {
  it('posts the QR content with the bearer token and returns the spot', async () => {
    const { client, fetchFunction } = clientAnswering(jsonResponse(entered));

    await expect(client.enter(ENTREE_DEMO_QR)).resolves.toEqual(entered);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ qrContent: ENTREE_DEMO_QR }),
      }),
    );
  });

  it.each([
    [400, 'QR_NOT_RECOGNIZED'],
    [402, 'CARD_DECLINED'],
    [409, 'PREREQUISITES_MISSING'],
  ])('reports a %i with the API reason %s', async (status, code) => {
    const { client } = clientAnswering(jsonResponse({ statusCode: status, error: code, message: 'refused' }, status));

    await expect(client.enter(ENTREE_DEMO_QR)).rejects.toEqual(new PalierRejectedError(code));
  });

  it('reports a 503 as a status error, not a refusal', async () => {
    const { client } = clientAnswering(jsonResponse({ error: 'PAYMENTS_UNAVAILABLE' }, 503));

    await expect(client.enter(ENTREE_DEMO_QR)).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('signs the driver out on 401', async () => {
    const onUnauthorized = jest.fn();
    const { client } = clientAnswering(jsonResponse({ error: 'Unauthorized' }, 401), { onUnauthorized });

    await expect(client.enter(ENTREE_DEMO_QR)).rejects.toBeInstanceOf(PalierUnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('asks the app to show the notice again on 403 CONSENT_REQUIRED', async () => {
    const onConsentRequired = jest.fn();
    const { client } = clientAnswering(jsonResponse({ error: 'CONSENT_REQUIRED' }, 403), { onConsentRequired });

    await expect(client.enter(ENTREE_DEMO_QR)).rejects.toBeInstanceOf(PalierConsentRequiredError);
    expect(onConsentRequired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['without a spot', { sessionId: 'session-1', barrierOpened: true }],
    ['with a closed barrier', { ...entered, barrierOpened: false }],
    ['with a spot number that is not text', { ...entered, spot: { ...spotA1, number: 1 } }],
    ['that is a list', [entered]],
  ])('treats an answer %s as unreachable', async (_case, body) => {
    const { client } = clientAnswering(jsonResponse(body));

    await expect(client.enter(ENTREE_DEMO_QR)).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

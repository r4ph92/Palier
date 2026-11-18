import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { HttpEntryClient } from '../src/api/HttpEntryClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../src/api/VehicleClient';
import { ENTREE_DEMO_QR, PARKING_DEMO_TARIFF, SOPHIE_NEW_TARIFF, spotA1 } from './fakeEntryClient';

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
  it('posts the QR content and the accepted tariff with the bearer token and returns the spot', async () => {
    const { client, fetchFunction } = clientAnswering(jsonResponse(entered));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).resolves.toEqual(entered);
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ qrContent: ENTREE_DEMO_QR, tariff: PARKING_DEMO_TARIFF }),
      }),
    );
  });

  it('carries the new tariff of a TARIFF_CHANGED refusal', async () => {
    const { client } = clientAnswering(jsonResponse({ statusCode: 409, error: 'TARIFF_CHANGED', message: 'changed', tariff: SOPHIE_NEW_TARIFF }, 409));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toMatchObject({ code: 'TARIFF_CHANGED', tariff: SOPHIE_NEW_TARIFF });
  });

  it.each([
    ['as text', '1,00 $ / 15 min'],
    ['without its cap', { incrementCents: 100, incrementMinutes: 15 }],
    ['with a zero increment', { ...SOPHIE_NEW_TARIFF, incrementMinutes: 0 }],
  ])('ignores a changed tariff given %s', async (_case, tariff) => {
    const { client } = clientAnswering(jsonResponse({ statusCode: 409, error: 'TARIFF_CHANGED', message: 'changed', tariff }, 409));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toMatchObject({ code: 'TARIFF_CHANGED', tariff: null });
  });

  describe('quote', () => {
    const quoted = { lotName: 'Parking Démo', tariff: PARKING_DEMO_TARIFF, holdCents: 2500 };

    it('posts the QR content to the quote route and returns the lot, its tariff and the hold', async () => {
      const { client, fetchFunction } = clientAnswering(jsonResponse(quoted, 200));

      await expect(client.quote(ENTREE_DEMO_QR)).resolves.toEqual(quoted);
      expect(fetchFunction).toHaveBeenCalledWith(
        `${BASE_URL}/v1/entries/quote`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ qrContent: ENTREE_DEMO_QR }) }),
      );
    });

    it('reports the entry refusals of a quote with their code', async () => {
      const { client } = clientAnswering(jsonResponse({ statusCode: 409, error: 'LOT_FULL', message: 'full' }, 409));

      await expect(client.quote(ENTREE_DEMO_QR)).rejects.toMatchObject({ code: 'LOT_FULL' });
    });

    it.each([
      ['without a lot name', { tariff: PARKING_DEMO_TARIFF, holdCents: 2500 }],
      ['with a tariff that is not whole cents', { ...quoted, tariff: { ...PARKING_DEMO_TARIFF, incrementCents: 0.75 } }],
      ['without a hold', { lotName: 'Parking Démo', tariff: PARKING_DEMO_TARIFF }],
      ['with a zero hold', { ...quoted, holdCents: 0 }],
    ])('treats an answer %s as unreachable', async (_case, body) => {
      const { client } = clientAnswering(jsonResponse(body, 200));

      await expect(client.quote(ENTREE_DEMO_QR)).rejects.toBeInstanceOf(PalierUnreachableError);
    });
  });

  it.each([
    [400, 'QR_NOT_RECOGNIZED'],
    [402, 'CARD_DECLINED'],
    [409, 'PREREQUISITES_MISSING'],
    [429, 'TOO_MANY_ENTRIES'],
    [503, 'GATE_UNAVAILABLE'],
    [503, 'GATE_SILENT'],
    [503, 'PAYMENTS_UNAVAILABLE'],
  ])('reports a %i with the API reason %s', async (status, code) => {
    const { client } = clientAnswering(jsonResponse({ statusCode: status, error: code, message: 'refused' }, status));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toEqual(new PalierRejectedError(code));
  });

  it('carries the refused amount of a declined card', async () => {
    const { client } = clientAnswering(jsonResponse({ statusCode: 402, error: 'CARD_DECLINED', message: 'refused', authorizedCents: 2500 }, 402));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toMatchObject({ code: 'CARD_DECLINED', authorizedCents: 2500 });
  });

  it.each([-1, 12.5, '2500'])('ignores a refused amount of %p that is not whole cents', async (authorizedCents) => {
    const { client } = clientAnswering(jsonResponse({ statusCode: 402, error: 'CARD_DECLINED', message: 'refused', authorizedCents }, 402));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toMatchObject({ code: 'CARD_DECLINED', authorizedCents: null });
  });

  it('reports a 500 as a status error, not a refusal', async () => {
    const { client } = clientAnswering(jsonResponse({ statusCode: 500, error: 'Internal Server Error' }, 500));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('signs the driver out on 401', async () => {
    const onUnauthorized = jest.fn();
    const { client } = clientAnswering(jsonResponse({ error: 'Unauthorized' }, 401), { onUnauthorized });

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toBeInstanceOf(PalierUnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('asks the app to show the notice again on 403 CONSENT_REQUIRED', async () => {
    const onConsentRequired = jest.fn();
    const { client } = clientAnswering(jsonResponse({ error: 'CONSENT_REQUIRED' }, 403), { onConsentRequired });

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toBeInstanceOf(PalierConsentRequiredError);
    expect(onConsentRequired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['without a spot', { sessionId: 'session-1', barrierOpened: true }],
    ['with a closed barrier', { ...entered, barrierOpened: false }],
    ['with a spot number that is not text', { ...entered, spot: { ...spotA1, number: 1 } }],
    ['that is a list', [entered]],
  ])('treats an answer %s as unreachable', async (_case, body) => {
    const { client } = clientAnswering(jsonResponse(body));

    await expect(client.enter(ENTREE_DEMO_QR, PARKING_DEMO_TARIFF)).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  describe('status', () => {
    const confirmed = { sessionId: 'session-1', state: 'ENTRY_CONFIRMED', spot: spotA1, entryConfirmedAt: '2026-10-27T22:02:00.000Z' };

    it('gets the session with the bearer token and returns its state', async () => {
      const { client, fetchFunction } = clientAnswering(jsonResponse(confirmed, 200));

      await expect(client.status('session-1')).resolves.toEqual(confirmed);
      expect(fetchFunction).toHaveBeenCalledWith(
        `${BASE_URL}/v1/entries/session-1`,
        expect.objectContaining({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }),
      );
    });

    it('reports an unrecognized state as an unexpected response', async () => {
      const { client } = clientAnswering(jsonResponse({ ...confirmed, state: 'EXITED' }, 200));

      await expect(client.status('session-1')).rejects.toBeInstanceOf(PalierUnreachableError);
    });

    it('reports a 404 as a status error', async () => {
      const { client } = clientAnswering(jsonResponse({ statusCode: 404, error: 'SESSION_NOT_FOUND', message: 'No such entry.' }, 404));

      await expect(client.status('session-1')).rejects.toEqual(new PalierStatusError(404));
    });
  });
});

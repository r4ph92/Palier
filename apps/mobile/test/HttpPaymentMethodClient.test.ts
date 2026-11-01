import { HttpPaymentMethodClient } from '../src/api/HttpPaymentMethodClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'julie-token';

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function clientAnswering(response: Promise<Response>, onUnauthorized = () => undefined) {
  return new HttpPaymentMethodClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized, fetchFunction: () => response });
}

describe('HttpPaymentMethodClient', () => {
  it('sends the driver token and reads the saved card', async () => {
    const fetchFunction = jest.fn(() => jsonResponse({ card: { brand: 'visa', last4: '4242' } }));
    const client = new HttpPaymentMethodClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized: () => undefined, fetchFunction });

    await expect(client.fetchCard()).resolves.toEqual({ brand: 'visa', last4: '4242' });
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/payment-method`,
      expect.objectContaining({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }),
    );
  });

  it('reads no card when the driver has none', async () => {
    await expect(clientAnswering(jsonResponse({ card: null })).fetchCard()).resolves.toBeNull();
  });

  it('returns the client secret of a new setup intent', async () => {
    const fetchFunction = jest.fn(() => jsonResponse({ clientSecret: 'seti_secret_1' }));
    const client = new HttpPaymentMethodClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized: () => undefined, fetchFunction });

    await expect(client.createSetupIntent()).resolves.toBe('seti_secret_1');
    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/me/setup-intent`, expect.objectContaining({ method: 'POST' }));
  });

  it('sends only the payment method id when saving a card', async () => {
    const fetchFunction = jest.fn(() => jsonResponse({ brand: 'mastercard', last4: '4444' }));
    const client = new HttpPaymentMethodClient({ baseUrl: BASE_URL, token: TOKEN, onUnauthorized: () => undefined, fetchFunction });

    await expect(client.saveCard('pm_mastercard')).resolves.toEqual({ brand: 'mastercard', last4: '4444' });
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/me/payment-method`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ paymentMethodId: 'pm_mastercard' }) }),
    );
  });

  it('tells the app to sign out on 401, and reports the status', async () => {
    const onUnauthorized = jest.fn();

    const failure = clientAnswering(jsonResponse({}, 401), onUnauthorized).fetchCard();

    await expect(failure).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports a refused card as a status error, not as a saved card', async () => {
    const failure = clientAnswering(jsonResponse({ error: 'PAYMENT_METHOD_NOT_FOUND' }, 422)).saveCard('pm_other');

    await expect(failure).rejects.toBeInstanceOf(PalierStatusError);
    await expect(failure).rejects.toMatchObject({ status: 422 });
  });

  it('treats a network failure as unreachable and keeps its cause', async () => {
    const networkFailure = new TypeError('Network request failed');

    await expect(clientAnswering(Promise.reject(networkFailure)).fetchCard()).rejects.toMatchObject({
      name: 'PalierUnreachableError',
      cause: networkFailure,
    });
  });

  it('treats a card body of the wrong shape as unreachable', async () => {
    await expect(clientAnswering(jsonResponse({ card: { brand: 4242 } })).fetchCard()).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});

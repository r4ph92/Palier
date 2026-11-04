import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StripePaymentAuthorizer } from '../../src/infrastructure/stripe/StripePaymentAuthorizer.ts';

// The hand-built errors of stripePaymentAuthorizer.test.ts assume where stripe-node puts code and payment_intent;
// here the real client parses Stripe's real error bodies, served by a local stand-in (nothing leaves the machine).
const ERROR_BODIES: Record<string, { readonly status: number; readonly error: object }> = {
  pi_already_canceled: {
    status: 400,
    error: { type: 'invalid_request_error', code: 'payment_intent_unexpected_state', payment_intent: { id: 'pi_already_canceled', object: 'payment_intent', status: 'canceled' } },
  },
  pi_captured: {
    status: 400,
    error: { type: 'invalid_request_error', code: 'payment_intent_unexpected_state', payment_intent: { id: 'pi_captured', object: 'payment_intent', status: 'succeeded' } },
  },
  pi_missing: { status: 404, error: { type: 'invalid_request_error', code: 'resource_missing', param: 'intent' } },
  pi_stripe_down: { status: 500, error: { type: 'api_error' } },
  pi_rate_limited: { status: 429, error: { type: 'invalid_request_error', code: 'rate_limit' } },
};

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

let server: Server;
let authorizer: StripePaymentAuthorizer;

beforeAll(async () => {
  server = createServer((request, response) => {
    const intentId = (request.url ?? '').split('/')[3] ?? '';
    if (intentId === 'pi_never_answers') {
      return;
    }
    const refusal = ERROR_BODIES[intentId];
    if (refusal === undefined) {
      answer(response, 200, { id: intentId, object: 'payment_intent', status: 'canceled' });
      return;
    }
    answer(response, refusal.status, { error: { message: 'refused', ...refusal.error } });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const stripe = new Stripe('sk_test_local_stand_in', { host: '127.0.0.1', port, protocol: 'http', timeout: 200, maxNetworkRetries: 0 });
  authorizer = new StripePaymentAuthorizer(stripe);
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('releasing a hold through the real Stripe client', () => {
  it.each([
    ['an intent Stripe cancels now', 'pi_julie', 'released'],
    ['an intent Stripe had already canceled', 'pi_already_canceled', 'released'],
    ['an intent captured before the release', 'pi_captured', 'gone'],
    ['an intent Stripe does not know', 'pi_missing', 'gone'],
    ['a Stripe outage', 'pi_stripe_down', 'failed'],
    ['a rate limit', 'pi_rate_limited', 'failed'],
    ['a Stripe that never answers', 'pi_never_answers', 'failed'],
  ])('answers the outcome for %s', async (_case, paymentIntentId, outcome) => {
    expect(await authorizer.cancel(paymentIntentId)).toBe(outcome);
  });
});

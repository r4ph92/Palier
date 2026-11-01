import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardProviderUnavailableError } from '../../src/domain/payments/CardGateway.ts';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';
import { FakeCardGateway } from './fakeCardGateway.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };

describe('payment method routes', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;
  let cardGateway: FakeCardGateway;

  afterEach(() => server.close());

  function startServer() {
    driverRepository = new FakeDriverRepository();
    cardGateway = new FakeCardGateway();
    server = buildServer({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository: new FakeVehicleRepository(), cardGateway });
  }

  async function signedInWithNotice(driver: typeof julie) {
    const headers = await authorizationFor(driverRepository, driver);
    await acceptNoticeAs(driverRepository, driver);
    return headers;
  }

  async function saveCard(driver: typeof julie, card: { paymentMethodId: string; brand: string; last4: string }) {
    const headers = await signedInWithNotice(driver);
    await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });
    const customerId = await driverRepository.findStripeCustomerId(driver.id);
    cardGateway.attachCard(card.paymentMethodId, customerId ?? '', { brand: card.brand, last4: card.last4 });
    return server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: card.paymentMethodId } });
  }

  describe('GET /v1/me/payment-method', () => {
    it('answers 401 without a token', async () => {
      startServer();

      const response = await server.inject({ method: 'GET', url: '/v1/me/payment-method' });

      expect(response.statusCode).toBe(401);
    });

    it('answers 403 CONSENT_REQUIRED without the current notice, even when a card is saved', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);
      await driverRepository.saveSavedCard(julie.id, 'pm_visa', { brand: 'visa', last4: '4242' });

      const response = await server.inject({ method: 'GET', url: '/v1/me/payment-method', headers });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: string }>().error).toBe('CONSENT_REQUIRED');
      expect(response.body).not.toContain('4242');
    });

    it('reports no card when the driver has not added one', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'GET', url: '/v1/me/payment-method', headers });

      expect(response.json()).toEqual({ card: null });
    });

    it('never shows another driver’s card', async () => {
      startServer();
      await saveCard(julie, { paymentMethodId: 'pm_julie', brand: 'visa', last4: '4242' });
      const marcHeaders = await signedInWithNotice(marc);

      const marcResponse = await server.inject({ method: 'GET', url: '/v1/me/payment-method', headers: marcHeaders });

      expect(marcResponse.json()).toEqual({ card: null });
    });
  });

  describe('POST /v1/me/setup-intent', () => {
    it('answers 401 without a token and creates no Stripe customer', async () => {
      startServer();

      const response = await server.inject({ method: 'POST', url: '/v1/me/setup-intent' });

      expect(response.statusCode).toBe(401);
      expect(cardGateway.createdCustomerDriverIds).toEqual([]);
    });

    it('answers 403 CONSENT_REQUIRED without the current notice and creates no Stripe customer', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);

      const response = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: string }>().error).toBe('CONSENT_REQUIRED');
      expect(cardGateway.createdCustomerDriverIds).toEqual([]);
    });

    it('returns a client secret and creates the Stripe customer once, then reuses it', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);

      const first = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });
      const second = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      expect(first.statusCode).toBe(200);
      expect(first.json<{ clientSecret: string }>().clientSecret).toBe('seti_secret_cus_1');
      expect(second.json<{ clientSecret: string }>().clientSecret).toBe('seti_secret_cus_1');
      expect(cardGateway.createdCustomerDriverIds).toEqual([julie.id]);
    });

    it('gives both of two simultaneous setups the same Stripe customer', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);

      const [first, second] = await Promise.all([
        server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers }),
        server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers }),
      ]);

      expect(first.json<{ clientSecret: string }>().clientSecret).toBe(second.json<{ clientSecret: string }>().clientSecret);
      expect(await driverRepository.findStripeCustomerId(julie.id)).not.toBeNull();
    });

    it('answers 503 without Stripe’s own error text when Stripe refuses the request', async () => {
      driverRepository = new FakeDriverRepository();
      cardGateway = new FakeCardGateway();
      vi.spyOn(cardGateway, 'createSetupIntentClientSecret').mockRejectedValue(new CardProviderUnavailableError());
      server = buildServer({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository: new FakeVehicleRepository(), cardGateway });
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain('stripe');
    });

    it('answers 429 after five setups in ten minutes, and does not hold back another driver', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);
      const marcHeaders = await signedInWithNotice(marc);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers })).statusCode).toBe(200);
      }

      const sixth = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });
      const marcFirst = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers: marcHeaders });

      expect(sixth.statusCode).toBe(429);
      expect(sixth.json<{ error: string }>().error).toBe('TOO_MANY_SETUPS');
      expect(marcFirst.statusCode).toBe(200);
    });

    it('answers 503 when no card gateway is configured', async () => {
      driverRepository = new FakeDriverRepository();
      server = buildServer({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository: new FakeVehicleRepository() });
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      expect(response.statusCode).toBe(503);
    });
  });

});

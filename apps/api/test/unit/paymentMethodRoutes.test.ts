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

    it('answers 503 when no card gateway is configured', async () => {
      driverRepository = new FakeDriverRepository();
      server = buildServer({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository: new FakeVehicleRepository() });
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      expect(response.statusCode).toBe(503);
    });
  });

  describe('PUT /v1/me/payment-method', () => {
    it('answers 401 without a token and saves nothing', async () => {
      startServer();

      const response = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', payload: { paymentMethodId: 'pm_julie' } });

      expect(response.statusCode).toBe(401);
      expect(driverRepository.savedPaymentMethodId(julie.id)).toBeNull();
    });

    it('answers 403 CONSENT_REQUIRED without the current notice and saves nothing', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);

      const response = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: 'pm_julie' } });

      expect(response.statusCode).toBe(403);
      expect(driverRepository.savedPaymentMethodId(julie.id)).toBeNull();
    });

    it('saves the card brand and last four digits and returns them', async () => {
      startServer();

      const response = await saveCard(julie, { paymentMethodId: 'pm_visa', brand: 'visa', last4: '4242' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ brand: 'visa', last4: '4242' });
      expect(driverRepository.savedPaymentMethodId(julie.id)).toBe('pm_visa');
    });

    it('replaces her Visa with a Mastercard, and her next lookup shows the new one', async () => {
      startServer();
      await saveCard(julie, { paymentMethodId: 'pm_visa', brand: 'visa', last4: '4242' });

      const replacement = await saveCard(julie, { paymentMethodId: 'pm_mastercard', brand: 'mastercard', last4: '4444' });
      const headers = await signedInWithNotice(julie);
      const lookup = await server.inject({ method: 'GET', url: '/v1/me/payment-method', headers });

      expect(replacement.statusCode).toBe(200);
      expect(lookup.json()).toEqual({ card: { brand: 'mastercard', last4: '4444' } });
      expect(driverRepository.savedPaymentMethodId(julie.id)).toBe('pm_mastercard');
    });

    it('answers 422 and saves nothing for a card that is not attached to her customer', async () => {
      startServer();
      await saveCard(marc, { paymentMethodId: 'pm_marc', brand: 'visa', last4: '4242' });
      const headers = await signedInWithNotice(julie);
      await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });

      const response = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: 'pm_marc' } });

      expect(response.statusCode).toBe(422);
      expect(response.json<{ error: string }>().error).toBe('PAYMENT_METHOD_NOT_FOUND');
      expect(driverRepository.savedPaymentMethodId(julie.id)).toBeNull();
    });

    it('answers 422 for an unknown card, and for a driver with no Stripe customer yet', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);

      const noCustomer = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: 'pm_unknown' } });
      await server.inject({ method: 'POST', url: '/v1/me/setup-intent', headers });
      const unknown = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: 'pm_unknown' } });

      expect(noCustomer.statusCode).toBe(422);
      expect(unknown.statusCode).toBe(422);
    });

    it('answers 400 for an id that is not a Stripe payment method id', async () => {
      startServer();
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: '4242 4242 4242 4242' } });

      expect(response.statusCode).toBe(400);
    });

    it('answers 503 when no card gateway is configured', async () => {
      driverRepository = new FakeDriverRepository();
      server = buildServer({ lotAvailabilityRepository: noLots, driverRepository, vehicleRepository: new FakeVehicleRepository() });
      const headers = await signedInWithNotice(julie);

      const response = await server.inject({ method: 'PUT', url: '/v1/me/payment-method', headers, payload: { paymentMethodId: 'pm_visa' } });

      expect(response.statusCode).toBe(503);
    });
  });
});

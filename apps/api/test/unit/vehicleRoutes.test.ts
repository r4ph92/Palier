import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };
const abc123 = { plate: 'abc 123', province: 'QC' };

describe('vehicle routes', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;
  let vehicleRepository: FakeVehicleRepository;

  afterEach(() => server.close());

  function startServer() {
    driverRepository = new FakeDriverRepository();
    vehicleRepository = new FakeVehicleRepository();
    server = buildServer({ vehicleRepository, lotAvailabilityRepository: noLots, driverRepository });
  }

  describe('for a driver who has not accepted the privacy notice', () => {
    it('refuses to register a vehicle with 403 and saves nothing', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'CONSENT_REQUIRED' });
      expect(vehicleRepository.savedCount).toBe(0);
    });

    it('refuses to list vehicles with 403', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);

      const response = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });

      expect(response.statusCode).toBe(403);
    });

    it('refuses to read a vehicle by id with 403', async () => {
      startServer();
      const headers = await authorizationFor(driverRepository, julie);

      const response = await server.inject({ method: 'GET', url: '/v1/me/vehicles/00000000-0000-4000-8000-000000000901', headers });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('without a token', () => {
    it('answers 401 and saves nothing', async () => {
      startServer();

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', payload: abc123 });

      expect(response.statusCode).toBe(401);
      expect(vehicleRepository.savedCount).toBe(0);
    });

    it('answers 401, not 400, when the body is invalid', async () => {
      startServer();

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', payload: {} });

      expect(response.statusCode).toBe(401);
    });

    it('answers 401 when listing vehicles', async () => {
      startServer();

      const response = await server.inject({ method: 'GET', url: '/v1/me/vehicles' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('for a driver who has accepted the privacy notice', () => {
    async function signInConsentedJulie() {
      startServer();
      await acceptNoticeAs(driverRepository, julie, PRIVACY_NOTICE_VERSION);
      return authorizationFor(driverRepository, julie);
    }

    it('registers the plate in upper case with its province and answers 201', async () => {
      const headers = await signInConsentedJulie();

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ plate: 'ABC 123', province: 'QC' });
      expect(vehicleRepository.savedCount).toBe(1);
    });

    it('lists the vehicles of the signed-in driver', async () => {
      const headers = await signInConsentedJulie();
      await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });

      const response = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });

      expect(response.json()).toEqual([expect.objectContaining({ plate: 'ABC 123', province: 'QC' })]);
    });

    it('answers 409 for the same plate and province twice, and saves no duplicate', async () => {
      const headers = await signInConsentedJulie();
      await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: { plate: 'ABC123', province: 'QC' } });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'VEHICLE_ALREADY_REGISTERED' });
      expect(vehicleRepository.savedCount).toBe(1);
    });

    it('refuses an empty plate, a plate longer than eight characters, or a bad character, and saves nothing', async () => {
      const headers = await signInConsentedJulie();

      for (const plate of ['', '-', 'ABCD12345', 'AB_123']) {
        const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: { plate, province: 'QC' } });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: 'INVALID_PLATE' });
      }
      expect(vehicleRepository.savedCount).toBe(0);
    });

    it('refuses a province that is not a code in the list, and saves nothing', async () => {
      const headers = await signInConsentedJulie();

      const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: { plate: 'ABC 123', province: 'XX' } });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'INVALID_PROVINCE' });
      expect(vehicleRepository.savedCount).toBe(0);
    });

    it('answers 404 when another driver reads a vehicle by its id', async () => {
      const headers = await signInConsentedJulie();
      const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
      const { id } = created.json<{ id: string }>();
      await acceptNoticeAs(driverRepository, marc, PRIVACY_NOTICE_VERSION);
      const marcHeaders = await authorizationFor(driverRepository, marc);

      const response = await server.inject({ method: 'GET', url: `/v1/me/vehicles/${id}`, headers: marcHeaders });

      expect(response.statusCode).toBe(404);
    });
  });
});

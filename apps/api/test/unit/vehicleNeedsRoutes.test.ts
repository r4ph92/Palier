import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie, marc } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const noLots = { findOnlineLots: () => Promise.resolve([]) };
const abc123 = { plate: 'abc 123', province: 'QC' };

describe('vehicle needs routes', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;
  let vehicleRepository: FakeVehicleRepository;

  afterEach(() => server.close());

  function startServer() {
    driverRepository = new FakeDriverRepository();
    vehicleRepository = new FakeVehicleRepository();
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ vehicleRepository, lotAvailabilityRepository: noLots, driverRepository }) });
  }

  async function signInConsentedJulie() {
    startServer();
    await acceptNoticeAs(driverRepository, julie, PRIVACY_NOTICE_VERSION);
    return authorizationFor(driverRepository, julie);
  }

  it('refuses to edit the needs before the driver consents, with 403', async () => {
    startServer();
    const headers = await authorizationFor(driverRepository, julie);

    const response = await server.inject({
      method: 'PATCH',
      url: '/v1/me/vehicles/00000000-0000-4000-8000-000000000901',
      headers,
      payload: { isElectric: true, hasAccessiblePermit: false, isOversize: false },
    });

    expect(response.statusCode).toBe(403);
  });

  it('saves a vehicle without declared needs as a standard vehicle', async () => {
    const headers = await signInConsentedJulie();

    const response = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });

    expect(response.json()).toMatchObject({ isElectric: false, hasAccessiblePermit: false, isOversize: false });
  });

  it('saves the needs ticked when the vehicle is added', async () => {
    const headers = await signInConsentedJulie();

    const response = await server.inject({
      method: 'POST',
      url: '/v1/me/vehicles',
      headers,
      payload: { ...abc123, isElectric: true, hasAccessiblePermit: true, isOversize: false },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ isElectric: true, hasAccessiblePermit: true, isOversize: false });
  });

  it('saves edited needs and lists the vehicle with them', async () => {
    const headers = await signInConsentedJulie();
    const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
    const { id } = created.json<{ id: string }>();
    const needs = { isElectric: true, hasAccessiblePermit: true, isOversize: true };

    const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: needs });
    const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id, plate: 'ABC 123', ...needs });
    expect(listed.json()).toEqual([expect.objectContaining({ id, ...needs })]);
  });

  it('refuses edited needs that are missing or not booleans, and changes nothing', async () => {
    const headers = await signInConsentedJulie();
    const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
    const { id } = created.json<{ id: string }>();
    const needs = { isElectric: true, hasAccessiblePermit: false, isOversize: false };

    for (const payload of [{ isElectric: true }, { ...needs, isOversize: 'yes' }, { ...needs, isOversize: null }]) {
      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload });

      expect(response.statusCode).toBe(400);
    }
    const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });
    expect(listed.json()).toEqual([expect.objectContaining({ plate: 'ABC 123', isElectric: false, isOversize: false })]);
  });

  it('keeps the plate when edited needs carry one', async () => {
    const headers = await signInConsentedJulie();
    const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
    const { id } = created.json<{ id: string }>();

    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/me/vehicles/${id}`,
      headers,
      payload: { isElectric: true, hasAccessiblePermit: false, isOversize: false, plate: 'ZZZ 999' },
    });

    expect(response.json()).toMatchObject({ plate: 'ABC 123', isElectric: true });
  });

  it('answers 404 when another driver edits the needs of a vehicle by its id, and changes nothing', async () => {
    const headers = await signInConsentedJulie();
    const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
    const { id } = created.json<{ id: string }>();
    await acceptNoticeAs(driverRepository, marc, PRIVACY_NOTICE_VERSION);
    const marcHeaders = await authorizationFor(driverRepository, marc);

    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/me/vehicles/${id}`,
      headers: marcHeaders,
      payload: { isElectric: true, hasAccessiblePermit: true, isOversize: true },
    });
    const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });

    expect(response.statusCode).toBe(404);
    expect(listed.json()).toEqual([expect.objectContaining({ id, isElectric: false, hasAccessiblePermit: false, isOversize: false })]);
  });

  describe('transponder', () => {
    const standard = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

    async function createdVehicle() {
      const headers = await signInConsentedJulie();
      const created = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers, payload: abc123 });
      return { headers, id: created.json<{ id: string }>().id };
    }

    it('starts a vehicle without a transponder', async () => {
      const { headers } = await createdVehicle();

      const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });

      expect(listed.json()).toEqual([expect.objectContaining({ transponder: null })]);
    });

    it('saves the transponder upper-case, trimmed', async () => {
      const { headers, id } = await createdVehicle();

      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: ' t-0042 ' } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ transponder: 'T-0042' });
    });

    it('keeps the transponder when an edit leaves it out', async () => {
      const { headers, id } = await createdVehicle();
      await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: 'T-0042' } });

      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, isElectric: true } });

      expect(response.json()).toMatchObject({ transponder: 'T-0042', isElectric: true });
    });

    it('clears the transponder when an edit sends it empty', async () => {
      const { headers, id } = await createdVehicle();
      await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: 'T-0042' } });

      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: '  ' } });

      expect(response.json()).toMatchObject({ transponder: null });
    });

    it('refuses a transponder another driver already has, with 409, and keeps the vehicle as it was', async () => {
      const { headers, id } = await createdVehicle();
      await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: 'T-0042' } });
      await acceptNoticeAs(driverRepository, marc, PRIVACY_NOTICE_VERSION);
      const marcHeaders = await authorizationFor(driverRepository, marc);
      const marcs = await server.inject({ method: 'POST', url: '/v1/me/vehicles', headers: marcHeaders, payload: { plate: 'XYZ 789', province: 'QC' } });
      const marcId = marcs.json<{ id: string }>().id;

      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${marcId}`, headers: marcHeaders, payload: { ...standard, transponder: 't0042' } });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'TRANSPONDER_ALREADY_REGISTERED' });
      const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers: marcHeaders });
      expect(listed.json()).toEqual([expect.objectContaining({ transponder: null })]);
    });

    it('lets a driver save the same transponder again on the same vehicle', async () => {
      const { headers, id } = await createdVehicle();
      await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder: 'T-0042' } });

      const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, isElectric: true, transponder: 't 0042' } });

      expect(response.statusCode).toBe(200);
    });

    it('refuses a transponder with forbidden characters or too long, and changes nothing', async () => {
      const { headers, id } = await createdVehicle();

      for (const transponder of ['T_0042', "T';--", 'T-00420042', '--']) {
        const response = await server.inject({ method: 'PATCH', url: `/v1/me/vehicles/${id}`, headers, payload: { ...standard, transponder } });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: 'INVALID_TRANSPONDER' });
      }
      const listed = await server.inject({ method: 'GET', url: '/v1/me/vehicles', headers });
      expect(listed.json()).toEqual([expect.objectContaining({ transponder: null })]);
    });
  });
});

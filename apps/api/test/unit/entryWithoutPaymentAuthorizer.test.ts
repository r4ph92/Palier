import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { buildServer, type ServerDependencies } from '../../src/http/buildServer.ts';
import { FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, fakeEntries } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';
import { fakeRepositories, serverDependencies } from './fakes/serverDependencies.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);
const alteredQr = `${entreeDemoQr.slice(0, -1)}${entreeDemoQr.endsWith('A') ? 'B' : 'A'}`;

describe('POST /v1/entries without payments', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function start(withEntries: (drivers: FakeDriverRepository, vehicles: FakeVehicleRepository) => Partial<ServerDependencies>) {
    const drivers = new FakeDriverRepository();
    const vehicles = new FakeVehicleRepository();
    const base = serverDependencies();
    const repositories = fakeRepositories({ driverRepository: drivers, vehicleRepository: vehicles });
    server = buildServer({ ...base, repositories, ...withEntries(drivers, vehicles) });
    const headers = await readyDriver(drivers, vehicles);
    return (qrContent: string) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
  }

  it('answers 503 PAYMENTS_UNAVAILABLE when the server was built without entries', async () => {
    const enter = await start(() => ({}));

    const response = await enter(entreeDemoQr);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'PAYMENTS_UNAVAILABLE' });
  });

  describe('without a Stripe key', () => {
    let journal: readonly string[] = [];

    function withoutPaymentAuthorizer(drivers: FakeDriverRepository, vehicles: FakeVehicleRepository): Partial<ServerDependencies> {
      const entries = fakeEntries({ drivers, vehicles, hasPaymentAuthorizer: false });
      journal = entries.journal;
      return { entries: entries.dependencies };
    }

    it('still refuses an altered QR with 400 QR_NOT_RECOGNIZED', async () => {
      const enter = await start(withoutPaymentAuthorizer);

      const response = await enter(alteredQr);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'QR_NOT_RECOGNIZED' });
    });

    it('answers 503 PAYMENTS_UNAVAILABLE to an eligible entry before taking a spot', async () => {
      const enter = await start(withoutPaymentAuthorizer);

      const response = await enter(entreeDemoQr);

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'PAYMENTS_UNAVAILABLE' });
      expect(journal).toEqual([]);
    });
  });
});

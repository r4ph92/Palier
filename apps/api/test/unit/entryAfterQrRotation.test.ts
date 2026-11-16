import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { newQrSecret } from '../../src/domain/gates/newGateSecret.ts';
import { configureServer } from './configureServer.ts';
import { ENTREE_DEMO_SECRET, ENTREE_ROY_SECRET, entreeDemoGate, entreeRoyGate, FakeEntryGateRepository, sortieDemoGate, ACCEPTED_DEMO_TARIFF } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';

// The entry reads the gate's secret at each scan, so a rotated secret is the one these gates now hold.
const rotatedDemoSecret = newQrSecret();
const rotatedRoySecret = newQrSecret();
const rotatedGates = new FakeEntryGateRepository([
  { ...entreeDemoGate, qrSecret: rotatedDemoSecret },
  sortieDemoGate,
  { ...entreeRoyGate, qrSecret: rotatedRoySecret },
]);

describe('scanning a gate QR after its secret was regenerated', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieAtTheGates() {
    const configured = configureServer({ entryGates: rotatedGates });
    server = configured.server;
    const headers = await readyDriver(configured.driverRepository, configured.vehicleRepository);
    return (link: string) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: link , tariff: ACCEPTED_DEMO_TARIFF } });
  }

  it('refuses the old printed QR as QR_NOT_RECOGNIZED and admits Julie with the new one', async () => {
    const enter = await julieAtTheGates();

    const old = await enter(gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET));
    expect(old.statusCode).toBe(400);
    expect(old.json()).toMatchObject({ error: 'QR_NOT_RECOGNIZED' });

    expect((await enter(gateQrLink(entreeDemoGate.id, rotatedDemoSecret))).statusCode).toBe(201);
  });

  it('recognizes the new QR of Pierre’s offline lot, which then refuses for the lot, not the QR', async () => {
    const enter = await julieAtTheGates();

    expect((await enter(gateQrLink(entreeRoyGate.id, ENTREE_ROY_SECRET))).json()).toMatchObject({ error: 'QR_NOT_RECOGNIZED' });
    expect((await enter(gateQrLink(entreeRoyGate.id, rotatedRoySecret))).json()).toMatchObject({ error: 'LOT_NOT_IN_SERVICE' });
  });
});

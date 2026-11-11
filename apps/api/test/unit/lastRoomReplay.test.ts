import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EntryGate, EntryGateRepository } from '../../src/domain/entries/EntryGateRepository.ts';
import { gateQrLink } from '../../src/domain/entries/gateToken.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { FakeDriverRepository } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate, fakeEntries, type FakeEntries } from './fakes/entryFakes.ts';
import { readyDriver } from './fakes/readyDriver.ts';
import { fakeRepositories, serverDependencies } from './fakes/serverDependencies.ts';

const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

// Parking Démo at capacity 10 with 9 counted vehicles: each session the fake opened holds an ASSIGNED spot.
class LastRoomGates implements EntryGateRepository {
  entries: FakeEntries | undefined;

  findGate(gateId: string): Promise<EntryGate | null> {
    const assignedSpotCount = this.entries?.sessions.drafts.length ?? 0;
    const gate = { ...entreeDemoGate, lot: { ...entreeDemoGate.lot, vehicleCount: 9, assignedSpotCount } };
    return Promise.resolve(gateId === gate.id ? gate : null);
  }
}

// #110 pentest: the driver who took the last room re-scans while her entry is still opening (app timeout, double tap).
describe('a re-scan by the driver who took the last room', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startAtLastRoom() {
    const drivers = new FakeDriverRepository();
    const vehicles = new FakeVehicleRepository();
    const gates = new LastRoomGates();
    const entries = fakeEntries({ drivers, vehicles, gates });
    gates.entries = entries;
    const repositories = fakeRepositories({ driverRepository: drivers, vehicleRepository: vehicles });
    server = buildServer({ ...serverDependencies(), repositories, entries: entries.dependencies });
    const headers = await readyDriver(drivers, vehicles);
    const enter = () => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent: entreeDemoQr } });
    return { entries, enter };
  }

  it('hands her own entry back, with no second card hold or barrier opening', async () => {
    const { entries, enter } = await startAtLastRoom();

    const first = await enter();
    const again = await enter();

    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(201);
    expect(again.json()).toEqual(first.json());
    expect(entries.payments.authorized).toHaveLength(1);
    expect(entries.gateCommander.opened).toHaveLength(1);
  });
});

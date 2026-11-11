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
// A second entry gate of Parking Démo, signed with the same secret.
const SECOND_ENTRY_GATE_ID = '00000000-0000-4000-8000-000000000799';
const secondEntryQr = gateQrLink(SECOND_ENTRY_GATE_ID, ENTREE_DEMO_SECRET);

// Parking Démo at capacity 10 with 9 counted vehicles: each session the fake opened holds an ASSIGNED spot.
class LastRoomGates implements EntryGateRepository {
  entries: FakeEntries | undefined;

  findGate(gateId: string): Promise<EntryGate | null> {
    const assignedSpotCount = this.entries?.sessions.drafts.length ?? 0;
    const lot = { ...entreeDemoGate.lot, vehicleCount: 9, assignedSpotCount };
    const known = gateId === entreeDemoGate.id || gateId === SECOND_ENTRY_GATE_ID;
    return Promise.resolve(known ? { ...entreeDemoGate, id: gateId, lot } : null);
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
    const enter = (qrContent = entreeDemoQr) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
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

  it('refuses ALREADY_INSIDE at another entry gate of the full lot, with no second spot or card hold', async () => {
    const { entries, enter } = await startAtLastRoom();
    await enter();

    const elsewhere = await enter(secondEntryQr);

    expect(elsewhere.statusCode).toBe(409);
    expect(elsewhere.json()).toMatchObject({ error: 'ALREADY_INSIDE' });
    expect(entries.sessions.drafts).toHaveLength(1);
    expect(entries.payments.authorized).toHaveLength(1);
  });
});

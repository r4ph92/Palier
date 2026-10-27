import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedGate } from '../../src/domain/gates/AuthenticatedGate.ts';
import { authenticateDeviceKey } from '../../src/domain/gates/authenticateDeviceKey.ts';
import { connectToDatabase } from '../../src/infrastructure/postgres/database.ts';
import { PostgresGateDeviceKeyRepository } from '../../src/infrastructure/postgres/PostgresGateDeviceKeyRepository.ts';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { gate, gatePassage, parkingLot } from '../../src/infrastructure/postgres/schema.ts';
import { runMigrations } from '../../src/migrate/runMigrations.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import {
  ENTREE_DEMO_DEVICE_KEY,
  ENTREE_DEMO_ID,
  REVOKED_ENTREE_DEMO_DEVICE_KEY,
  SORTIE_DEMO_DEVICE_KEY,
  SORTIE_DEMO_ID,
} from '../../src/seed/fixtures/gates.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { seedDatabase } from '../../src/seed/seedDatabase.ts';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

const databaseUrl = databaseUrlAllowedForSeeding(process.env);
const connection = connectToDatabase(databaseUrl);
const database = connection.database;
const ledger = new PostgresPassageLedger(database);
const deviceKeys = new PostgresGateDeviceKeyRepository(database);
const closedAt = new Date('2026-10-27T22:02:00Z');

const entreeDemo: AuthenticatedGate = {
  id: ENTREE_DEMO_ID,
  lotId: PARKING_DEMO_ID,
  lotName: 'Parking Démo',
  name: 'Entrée Démo',
  kind: 'ENTRY',
  hasLoops: true,
};
const sortieDemo: AuthenticatedGate = { ...entreeDemo, id: SORTIE_DEMO_ID, name: 'Sortie Démo', kind: 'EXIT' };

beforeAll(() => runMigrations(databaseUrl));
beforeEach(() => seedDatabase(database));
afterAll(() => connection.close());

async function parkingDemoVehicleCount(): Promise<number | undefined> {
  const rows = await database.select({ count: parkingLot.vehicleCount }).from(parkingLot).where(eq(parkingLot.id, PARKING_DEMO_ID));
  return rows[0]?.count;
}

async function passageCount(): Promise<number> {
  return (await database.select({ id: gatePassage.id }).from(gatePassage)).length;
}

describe('PostgresPassageLedger', () => {
  it('records the passage and counts the vehicle in one statement', async () => {
    const recorded = await ledger.recordPassage({ gate: entreeDemo, closedAt, vehicleCountChange: 1 });

    expect(recorded).toEqual({ vehicleCount: 1 });
    expect(await parkingDemoVehicleCount()).toBe(1);
    const passages = await database.select().from(gatePassage);
    expect(passages).toMatchObject([{ gateId: ENTREE_DEMO_ID, lotId: PARKING_DEMO_ID, closedAt }]);
  });

  it('keeps the count at zero on an exit when the lot is empty, and still records the passage', async () => {
    const recorded = await ledger.recordPassage({ gate: sortieDemo, closedAt, vehicleCountChange: -1 });

    expect(recorded).toEqual({ vehicleCount: 0 });
    expect(await passageCount()).toBe(1);
  });

  it('counts above the capacity', async () => {
    for (let entry = 0; entry < 12; entry += 1) {
      await ledger.recordPassage({ gate: entreeDemo, closedAt, vehicleCountChange: 1 });
    }

    expect(await parkingDemoVehicleCount()).toBe(12);
  });

  it('counts every concurrent entry', async () => {
    const entries = Array.from({ length: 10 }, () => ledger.recordPassage({ gate: entreeDemo, closedAt, vehicleCountChange: 1 }));

    await Promise.all(entries);

    expect(await parkingDemoVehicleCount()).toBe(10);
  });

  it('changes nothing when the passage cannot be recorded', async () => {
    const gateInAnotherLot = { ...entreeDemo, lotId: GARAGE_ROY_ID };

    const recording = ledger.recordPassage({ gate: gateInAnotherLot, closedAt, vehicleCountChange: 1 });

    await expect(recording).rejects.toMatchObject({ cause: { constraint_name: 'gate_passage_gate_in_same_lot_fk' } });
    expect(await passageCount()).toBe(0);
    const garageRoy = await database.select({ count: parkingLot.vehicleCount }).from(parkingLot).where(eq(parkingLot.id, GARAGE_ROY_ID));
    expect(garageRoy[0]?.count).toBe(0);
  });
});

describe('PostgresGateDeviceKeyRepository with the seeded keys', () => {
  it('finds Entrée Démo and its lot from its device key', async () => {
    expect(await authenticateDeviceKey(ENTREE_DEMO_DEVICE_KEY, deviceKeys)).toEqual(entreeDemo);
  });

  it('finds Sortie Démo from its device key', async () => {
    expect(await authenticateDeviceKey(SORTIE_DEMO_DEVICE_KEY, deviceKeys)).toEqual(sortieDemo);
  });

  it('refuses the revoked key of Entrée Démo', async () => {
    expect(await authenticateDeviceKey(REVOKED_ENTREE_DEMO_DEVICE_KEY, deviceKeys)).toBeUndefined();
  });

  it('refuses an unknown key', async () => {
    expect(await authenticateDeviceKey('unknown-key', deviceKeys)).toBeUndefined();
  });
});

describe('seeded gates', () => {
  it('gives loops to all three gates', async () => {
    const gates = await database.select({ name: gate.name, hasLoops: gate.hasLoops }).from(gate).orderBy(gate.name);

    expect(gates).toEqual([
      { name: 'Entrée Démo', hasLoops: true },
      { name: 'Entrée Roy', hasLoops: true },
      { name: 'Sortie Démo', hasLoops: true },
    ]);
  });
});

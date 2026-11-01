import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase } from '../../src/infrastructure/postgres/database.ts';
import { PostgresVehicleRepository } from '../../src/infrastructure/postgres/PostgresVehicleRepository.ts';
import { runMigrations } from '../../src/migrate/runMigrations.ts';
import { JULIE_TREMBLAY_ID, MARC_GAGNON_ID } from '../../src/seed/fixtures/drivers.ts';
import { seedDatabase } from '../../src/seed/seedDatabase.ts';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

const databaseUrl = databaseUrlAllowedForSeeding(process.env);
const connection = connectToDatabase(databaseUrl);
const repository = new PostgresVehicleRepository(connection.database);
const abc123 = { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC' };

beforeAll(() => runMigrations(databaseUrl));
beforeEach(() => seedDatabase(connection.database));
afterAll(() => connection.close());

describe('PostgresVehicleRepository on the seeded database', () => {
  it('saves a vehicle and lists it for its driver only', async () => {
    const saved = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);

    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual([saved]);
    expect(await repository.listVehicles(MARC_GAGNON_ID)).toEqual([]);
  });

  it('refuses the same plate and province twice for one driver, and saves nothing more', async () => {
    await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);

    const again = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);

    expect(again).toBeNull();
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toHaveLength(1);
  });

  it('accepts the same plate in another province', async () => {
    await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);

    const other = await repository.saveVehicle(JULIE_TREMBLAY_ID, { ...abc123, province: 'ON' });

    expect(other).not.toBeNull();
  });

  it('finds a vehicle by id for its owner, and nobody else', async () => {
    const saved = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    if (saved === null) throw new Error('the vehicle should have been saved');

    expect(await repository.findVehicle(JULIE_TREMBLAY_ID, saved.id)).toEqual(saved);
    expect(await repository.findVehicle(MARC_GAGNON_ID, saved.id)).toBeNull();
  });

  it('makes the first vehicle of a driver the default one, and not the next ones', async () => {
    const first = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    const second = await repository.saveVehicle(JULIE_TREMBLAY_ID, { plate: 'DEF 456', plateKey: 'DEF456', province: 'QC' });

    expect(first).toMatchObject({ isDefault: true });
    expect(second).toMatchObject({ isDefault: false });
  });

  it('moves the default to the chosen vehicle, and only one vehicle stays default', async () => {
    const first = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    const second = await repository.saveVehicle(JULIE_TREMBLAY_ID, { plate: 'DEF 456', plateKey: 'DEF456', province: 'QC' });
    if (first === null || second === null) throw new Error('the vehicles should have been saved');

    const chosen = await repository.setDefaultVehicle(JULIE_TREMBLAY_ID, second.id);

    expect(chosen).toMatchObject({ id: second.id, isDefault: true });
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.id, isDefault: false }), expect.objectContaining({ id: second.id, isDefault: true })]),
    );
  });

  it('does not set a default on a vehicle of another driver', async () => {
    const saved = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    if (saved === null) throw new Error('the vehicle should have been saved');

    expect(await repository.setDefaultVehicle(MARC_GAGNON_ID, saved.id)).toBeNull();
  });

  it('deletes a vehicle that is not the default and keeps the default one', async () => {
    const first = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    const second = await repository.saveVehicle(JULIE_TREMBLAY_ID, { plate: 'DEF 456', plateKey: 'DEF456', province: 'QC' });
    if (first === null || second === null) throw new Error('the vehicles should have been saved');

    expect(await repository.deleteVehicle(JULIE_TREMBLAY_ID, second.id)).toBe('deleted');
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual([expect.objectContaining({ id: first.id, isDefault: true })]);
  });

  it('promotes another vehicle when the default one is deleted', async () => {
    const first = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    const second = await repository.saveVehicle(JULIE_TREMBLAY_ID, { plate: 'DEF 456', plateKey: 'DEF456', province: 'QC' });
    if (first === null || second === null) throw new Error('the vehicles should have been saved');

    expect(await repository.deleteVehicle(JULIE_TREMBLAY_ID, first.id)).toBe('deleted');
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual([expect.objectContaining({ id: second.id, isDefault: true })]);
  });

  it('refuses to delete the only vehicle of a driver, and keeps it', async () => {
    const saved = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    if (saved === null) throw new Error('the vehicle should have been saved');

    expect(await repository.deleteVehicle(JULIE_TREMBLAY_ID, saved.id)).toBe('last-vehicle');
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual([saved]);
  });

  it('reports not-found when deleting a vehicle of another driver, and deletes nothing', async () => {
    const saved = await repository.saveVehicle(JULIE_TREMBLAY_ID, abc123);
    if (saved === null) throw new Error('the vehicle should have been saved');

    expect(await repository.deleteVehicle(MARC_GAGNON_ID, saved.id)).toBe('not-found');
    expect(await repository.listVehicles(JULIE_TREMBLAY_ID)).toEqual([saved]);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase } from '../../src/infrastructure/postgres/database.ts';
import { PostgresLotAvailabilityRepository } from '../../src/infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { spot } from '../../src/infrastructure/postgres/schema.ts';
import { runMigrations } from '../../src/migrate/runMigrations.ts';
import { changeSpotState } from '../../src/seed/changeSpotState.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { seedDatabase } from '../../src/seed/seedDatabase.ts';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

const databaseUrl = databaseUrlAllowedForSeeding(process.env);
const connection = connectToDatabase(databaseUrl);
const repository = new PostgresLotAvailabilityRepository(connection.database);

beforeAll(() => runMigrations(databaseUrl));
beforeEach(() => seedDatabase(connection.database));
afterAll(() => connection.close());

describe('PostgresLotAvailabilityRepository on the seeded database', () => {
  it('reports the 10 available spots of Parking Démo', async () => {
    const lots = await repository.findOnlineLots();

    expect(lots).toEqual([
      { id: PARKING_DEMO_ID, name: 'Parking Démo', capacity: 10, vehicleCount: 0, availableSpotCount: 10 },
    ]);
  });

  it('counts 9 once A-1 is out of service', async () => {
    await changeSpotState(connection.database, { lotName: 'Parking Démo', spotNumber: 'A-1', state: 'OUT_OF_SERVICE' });

    const lots = await repository.findOnlineLots();

    expect(lots[0]?.availableSpotCount).toBe(9);
  });

  it('leaves Garage Roy out because it is not online', async () => {
    const lots = await repository.findOnlineLots();

    expect(lots.map((lot) => lot.id)).not.toContain(GARAGE_ROY_ID);
  });

  it('refuses a spot whose aisle belongs to another lot', async () => {
    const aisleOfParkingDemo = '00000000-0000-4000-8000-000000000401';
    const insertIntoGarageRoy = connection.database
      .insert(spot)
      .values({ aisleId: aisleOfParkingDemo, lotId: GARAGE_ROY_ID, number: 'X-1', distanceToExit: 5 });

    await expect(insertIntoGarageRoy).rejects.toMatchObject({ cause: { constraint_name: 'spot_aisle_in_same_lot_fk' } });
  });
});

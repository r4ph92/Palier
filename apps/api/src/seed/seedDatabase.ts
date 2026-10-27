import { sql } from 'drizzle-orm';
import type { Database } from '../infrastructure/postgres/database.ts';
import { aisle, level, operator, parkingLot, spot } from '../infrastructure/postgres/schema.ts';
import { garageRoyLot } from './fixtures/garageRoy.ts';
import { operatorFixtures } from './fixtures/operators.ts';
import { parkingDemoAisles, parkingDemoLevels, parkingDemoLot, parkingDemoSpots } from './fixtures/parkingDemo.ts';

export async function seedDatabase(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`truncate table spot, aisle, level, parking_lot, operator cascade`);
    await transaction.insert(operator).values(operatorFixtures);
    await transaction.insert(parkingLot).values([parkingDemoLot, garageRoyLot]);
    await transaction.insert(level).values(parkingDemoLevels);
    await transaction.insert(aisle).values(parkingDemoAisles);
    await transaction.insert(spot).values(parkingDemoSpots);
  });
}

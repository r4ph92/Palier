import { sql } from 'drizzle-orm';
import type { Database } from '../infrastructure/postgres/database.ts';
import { aisle, appUser, level, operator, parkingLot, spot } from '../infrastructure/postgres/schema.ts';
import { driverPersonas } from './fixtures/drivers.ts';
import { garageRoyLot } from './fixtures/garageRoy.ts';
import { operatorFixtures } from './fixtures/operators.ts';
import { parkingDemoAisles, parkingDemoLevels, parkingDemoLot, parkingDemoSpots } from './fixtures/parkingDemo.ts';
import type { StripeIds } from './stripeTestCustomers.ts';

const NO_STRIPE_IDS: ReadonlyMap<string, StripeIds> = new Map();

export async function seedDatabase(database: Database, stripeIds = NO_STRIPE_IDS): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`truncate table user_session_token, app_user, spot, aisle, level, parking_lot, operator cascade`);
    await transaction.insert(operator).values(operatorFixtures);
    await transaction.insert(parkingLot).values([parkingDemoLot, garageRoyLot]);
    await transaction.insert(level).values(parkingDemoLevels);
    await transaction.insert(aisle).values(parkingDemoAisles);
    await transaction.insert(spot).values(parkingDemoSpots);
    await transaction.insert(appUser).values(driverPersonas.map(({ user }) => ({ ...user, ...stripeIds.get(user.email) })));
  });
}

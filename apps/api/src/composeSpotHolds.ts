import { entryPolicyFor } from './composeEntries.ts';
import type { SpotHoldServices } from './http/routes/spotHoldRoutes.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresSpotHoldRepository } from './infrastructure/postgres/PostgresSpotHoldRepository.ts';

// A hold never calls Stripe: it only needs the database and the lot terms an entry would apply.
export function composeSpotHolds(database: Database, demoMode: boolean): SpotHoldServices {
  return { repository: new PostgresSpotHoldRepository(database), policy: entryPolicyFor(demoMode) };
}

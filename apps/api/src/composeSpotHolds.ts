import type { DriverPrerequisiteSources } from './domain/drivers/driverPrerequisites.ts';
import { entryPolicyFor, type EntryPolicy } from './domain/payments/EntryPolicy.ts';
import { SPOT_HOLD_ATTEMPT_LIMIT, SPOT_HOLD_ATTEMPT_WINDOW_MILLISECONDS } from './domain/spotHolds/spotHoldAttemptLimit.ts';
import { SpotHoldEligibility } from './domain/spotHolds/SpotHoldEligibility.ts';
import type { SpotHoldRepository } from './domain/spotHolds/SpotHoldRepository.ts';
import type { SpotHoldServices } from './http/routes/spotHoldRoutes.ts';
import { createSetupLimiter } from './http/SetupLimiter.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresSpotHoldRepository } from './infrastructure/postgres/PostgresSpotHoldRepository.ts';

// A hold never calls Stripe: it only needs the database and the lot terms an entry would apply.
export function composeSpotHolds(database: Database, demoMode: boolean, prerequisites: DriverPrerequisiteSources): SpotHoldServices {
  return spotHoldServicesOf(new PostgresSpotHoldRepository(database), prerequisites, entryPolicyFor(demoMode));
}

// Everything a hold request needs but the clock, which buildServer owns so the test clock can move it.
export function spotHoldServicesOf(repository: SpotHoldRepository, prerequisites: DriverPrerequisiteSources, policy: EntryPolicy): SpotHoldServices {
  return {
    eligibility: new SpotHoldEligibility({ prerequisites, spotHolds: repository, policy }),
    spotHolds: repository,
    attempts: createSetupLimiter(SPOT_HOLD_ATTEMPT_LIMIT, SPOT_HOLD_ATTEMPT_WINDOW_MILLISECONDS),
  };
}

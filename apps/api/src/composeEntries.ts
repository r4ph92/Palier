import Stripe from 'stripe';
import type { DriverRepository } from './domain/drivers/DriverRepository.ts';
import { EntryAdmission } from './domain/entries/EntryAdmission.ts';
import { EntryEligibility } from './domain/entries/EntryEligibility.ts';
import type { VehicleRepository } from './domain/vehicles/VehicleRepository.ts';
import type { EntryRouteDependencies } from './http/routes/entryRoutes.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresEntryGateRepository } from './infrastructure/postgres/PostgresEntryGateRepository.ts';
import { PostgresParkingSessionRepository } from './infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { SimulatedGateCommander } from './infrastructure/postgres/SimulatedGateCommander.ts';
import { StripePaymentAuthorizer } from './infrastructure/stripe/StripePaymentAuthorizer.ts';

// The driver waits at the barrier: a slow Stripe answer is cut at 5 s, and retries reuse the entry's idempotency key.
const STRIPE_TIMEOUT_MILLISECONDS = 5000;
const STRIPE_NETWORK_RETRIES = 2;

export interface EntryComposition {
  readonly database: Database;
  readonly stripeKey: string;
  readonly demoMode: boolean;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
}

export function composeEntries({ database, stripeKey, demoMode, drivers, vehicles }: EntryComposition): EntryRouteDependencies {
  const stripe = new Stripe(stripeKey, { timeout: STRIPE_TIMEOUT_MILLISECONDS, maxNetworkRetries: STRIPE_NETWORK_RETRIES });
  return {
    eligibility: new EntryEligibility({
      gates: new PostgresEntryGateRepository(database),
      vehicles,
      drivers,
      policy: { allowPlatformChargesWithoutOperatorAccount: demoMode },
    }),
    admission: new EntryAdmission({
      sessions: new PostgresParkingSessionRepository(database),
      payments: new StripePaymentAuthorizer(stripe),
      gateCommander: new SimulatedGateCommander(database),
    }),
  };
}

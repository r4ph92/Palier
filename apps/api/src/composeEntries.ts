import Stripe from 'stripe';
import type { DriverRepository } from './domain/drivers/DriverRepository.ts';
import { EntryAdmission } from './domain/entries/EntryAdmission.ts';
import { EntryEligibility } from './domain/entries/EntryEligibility.ts';
import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { VehicleRepository } from './domain/vehicles/VehicleRepository.ts';
import type { EntryRouteDependencies } from './http/routes/entryRoutes.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresEntryGateRepository } from './infrastructure/postgres/PostgresEntryGateRepository.ts';
import { PostgresParkingSessionRepository } from './infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { SimulatedGateCommander } from './infrastructure/postgres/SimulatedGateCommander.ts';
import { StripePaymentAuthorizer } from './infrastructure/stripe/StripePaymentAuthorizer.ts';
import { UnreachablePaymentAuthorizer } from './infrastructure/stripe/UnreachablePaymentAuthorizer.ts';

// The app gives up after 8 s: two attempts of 2.5 s plus the retry backoff stay under it, and the retry reuses the entry's idempotency key.
const STRIPE_TIMEOUT_MILLISECONDS = 2500;
const STRIPE_NETWORK_RETRIES = 1;

export interface EntryComposition {
  readonly database: Database;
  // Null without STRIPE_SECRET_KEY: QR refusals still answer, an eligible entry gets PAYMENTS_UNAVAILABLE.
  readonly stripeKey: string | null;
  readonly demoMode: boolean;
  // Test environments only: the entry takes its spot, then the hold fails as if Stripe were down.
  readonly simulateStripeUnreachable: boolean;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
}

export function composeEntries({ database, stripeKey, demoMode, simulateStripeUnreachable, drivers, vehicles }: EntryComposition): EntryRouteDependencies {
  const sessions = new PostgresParkingSessionRepository(database);
  return {
    sessions,
    eligibility: new EntryEligibility({
      gates: new PostgresEntryGateRepository(database),
      vehicles,
      drivers,
      policy: { allowPlatformChargesWithoutOperatorAccount: demoMode },
    }),
    admission: new EntryAdmission({
      sessions,
      payments: paymentAuthorizer(stripeKey, simulateStripeUnreachable),
      gateCommander: new SimulatedGateCommander(database),
    }),
  };
}

function paymentAuthorizer(stripeKey: string | null, simulateStripeUnreachable: boolean): PaymentAuthorizer | null {
  if (simulateStripeUnreachable) {
    return new UnreachablePaymentAuthorizer();
  }
  if (stripeKey === null) {
    return null;
  }
  return new StripePaymentAuthorizer(new Stripe(stripeKey, { timeout: STRIPE_TIMEOUT_MILLISECONDS, maxNetworkRetries: STRIPE_NETWORK_RETRIES }));
}

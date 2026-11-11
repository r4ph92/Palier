import Stripe from 'stripe';
import type { PaymentsSimulation } from './config/paymentsSimulation.ts';
import type { DriverRepository } from './domain/drivers/DriverRepository.ts';
import { EntryAdmission } from './domain/entries/EntryAdmission.ts';
import { EntryEligibility } from './domain/entries/EntryEligibility.ts';
import { entryPolicyFor } from './domain/payments/EntryPolicy.ts';
import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { OpeningWindow } from './domain/gates/OpeningWindow.ts';
import type { Clock } from './domain/time/Clock.ts';
import type { VehicleRepository } from './domain/vehicles/VehicleRepository.ts';
import type { EntryRouteDependencies } from './http/routes/entryRoutes.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresEntryGateRepository } from './infrastructure/postgres/PostgresEntryGateRepository.ts';
import { PostgresSpotHoldRepository } from './infrastructure/postgres/PostgresSpotHoldRepository.ts';
import { PostgresParkingSessionRepository } from './infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { SimulatedGateCommander } from './infrastructure/postgres/SimulatedGateCommander.ts';
import { SimulatedPaymentAuthorizer } from './infrastructure/stripe/SimulatedPaymentAuthorizer.ts';
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
  // Test environments only: holds fail as if Stripe were down, or succeed without calling it.
  readonly paymentsSimulation: PaymentsSimulation;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
  readonly openingWindow: OpeningWindow;
  readonly clock: Clock;
}

export interface ComposedEntries {
  readonly routes: EntryRouteDependencies;
  // The same Stripe client serves the entry routes and the cancellation job.
  readonly payments: PaymentAuthorizer | null;
}

export function composeEntries({ database, stripeKey, demoMode, paymentsSimulation, drivers, vehicles, openingWindow, clock }: EntryComposition): ComposedEntries {
  const sessions = new PostgresParkingSessionRepository(database, openingWindow, clock);
  const payments = paymentAuthorizer(stripeKey, paymentsSimulation);
  const routes = {
    sessions,
    clock,
    eligibility: new EntryEligibility({
      gates: new PostgresEntryGateRepository(database),
      vehicles,
      drivers,
      policy: entryPolicyFor(demoMode),
      spotHolds: new PostgresSpotHoldRepository(database),
    }),
    admission: new EntryAdmission({ sessions, payments, gateCommander: new SimulatedGateCommander(database) }),
  };
  return { routes, payments };
}

// Exported for its test: the unreachable simulation must win over a real key (readPaymentsSimulation refuses success beside one).
export function paymentAuthorizer(stripeKey: string | null, simulation: PaymentsSimulation): PaymentAuthorizer | null {
  if (simulation === 'unreachable') {
    return new UnreachablePaymentAuthorizer();
  }
  if (simulation === 'success') {
    return new SimulatedPaymentAuthorizer();
  }
  if (simulation === 'capture-unreachable') {
    return new SimulatedPaymentAuthorizer({ capturesFail: true });
  }
  if (simulation === 'surplus-declined') {
    return new SimulatedPaymentAuthorizer({ surplusFails: true });
  }
  if (stripeKey === null) {
    return null;
  }
  return new StripePaymentAuthorizer(new Stripe(stripeKey, { timeout: STRIPE_TIMEOUT_MILLISECONDS, maxNetworkRetries: STRIPE_NETWORK_RETRIES }));
}

import Fastify, { type FastifyInstance } from 'fastify';
import type { AccountWebhookReader, OperatorStripeAccounts, OperatorStripeGateway } from '../domain/dashboard/OperatorStripe.ts';
import type { OperatorRepository } from '../domain/dashboard/OperatorRepository.ts';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { DriverAccess } from '../domain/drivers/driverSessions.ts';
import type { CardGateway } from '../domain/payments/CardGateway.ts';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import type { CurrentParkingSessionQuery } from '../domain/parkingSessions/ActiveParkingSession.ts';
import type { ParkingSessionBackdater } from '../domain/parkingSessions/ParkingSessionBackdater.ts';
import type { SessionTokenRepository } from '../domain/sessions/SessionTokenRepository.ts';
import { systemClock } from '../domain/time/Clock.ts';
import { createTestClock, type TestClock } from '../domain/time/TestClock.ts';
import type { UserDirectory } from '../domain/sessions/UserDirectory.ts';
import type { VehicleRepository } from '../domain/vehicles/VehicleRepository.ts';
import type { DashboardRouteDependencies } from './dashboard/DashboardRouteDependencies.ts';
import { registerDashboardRoutes } from './dashboard/dashboardRoutes.ts';
import { registerDemoConsoleRoutes } from './demo/demoConsoleRoutes.ts';
import { handleServerError } from './handleServerError.ts';
import { requireMinimumAppVersion } from './requireMinimumAppVersion.ts';
import { registerCurrentParkingSessionRoute } from './routes/currentParkingSessionRoute.ts';
import { registerDriverRoutes } from './routes/driverRoutes.ts';
import { registerEntryRoutes, type EntryRouteDependencies } from './routes/entryRoutes.ts';
import { registerGateRoutes, type GateRouteDependencies } from './routes/gateRoutes.ts';
import { registerLotsRoutes } from './routes/lotsRoutes.ts';
import { registerStripeWebhookRoute } from './routes/stripeWebhookRoute.ts';
import { registerPaymentMethodRoutes } from './routes/paymentMethodRoutes.ts';
import { registerSpotHoldRoutes, type SpotHoldServices } from './routes/spotHoldRoutes.ts';
import { registerVehicleRoutes } from './routes/vehicleRoutes.ts';
import { registerTestClockRoutes, type TestClockRouteDependencies } from './routes/testClockRoutes.ts';
import { registerTestSignInRoutes } from './routes/testSignInRoutes.ts';

// Gateway and webhook reader are null without their Stripe settings: onboarding answers 503 and the webhook route does not exist.
export interface OperatorStripeDependencies {
  readonly accounts: OperatorStripeAccounts;
  readonly gateway: OperatorStripeGateway | null;
  readonly webhookReader: AccountWebhookReader | null;
}

export interface ServerDependencies {
  readonly repositories: {
    readonly lotAvailabilityRepository: LotAvailabilityRepository;
    readonly driverRepository: DriverRepository;
    readonly sessionTokenRepository: SessionTokenRepository;
    readonly userDirectory: UserDirectory;
    readonly vehicleRepository: VehicleRepository;
    readonly operatorRepository: OperatorRepository;
    readonly currentParkingSessions: CurrentParkingSessionQuery;
    readonly parkingSessionBackdater: ParkingSessionBackdater;
  };
  readonly gates: GateRouteDependencies;
  readonly cardGateway?: CardGateway | undefined;
  // main.ts always passes it; tests of other routes leave it out, and entries then answer 503 PAYMENTS_UNAVAILABLE.
  readonly entries?: EntryRouteDependencies | undefined;
  // main.ts always passes it; tests of other routes leave it out, and holds then answer 503 HOLD_UNAVAILABLE.
  readonly spotHolds?: SpotHoldServices | undefined;
  // main.ts always passes it; without it the dashboard cannot connect Stripe.
  readonly operatorStripe?: OperatorStripeDependencies | undefined;
  // Tests hand one in to move it directly. Used only when test sign-in is enabled, by the current session and the spot hold routes (place, read, release); gates keep their own clock.
  readonly testClock?: TestClock | undefined;
  readonly settings?: ServerSettings;
}

export interface ServerSettings {
  readonly testSignInEnabled?: boolean;
  readonly demoMode?: boolean;
  readonly logsRequests?: boolean;
  readonly minimumAppVersion?: string | undefined;
  readonly secureCookies?: boolean;
}

export function buildServer({ repositories, gates, cardGateway, entries, spotHolds, operatorStripe, testClock, settings = {} }: ServerDependencies): FastifyInstance {
  // Refuse a value of the wrong JSON type rather than converting it, so ["2026-10-28"] is not read as "2026-10-28".
  const server = Fastify({ logger: settings.logsRequests ?? false, ajv: { customOptions: { coerceTypes: false } } });
  server.setErrorHandler(handleServerError);
  server.decorateRequest('driver', null);
  void server.register(async (appScope) => registerAppRoutes(appScope, { repositories, cardGateway, entries, spotHolds, testClock, settings }));
  void server.register(async (dashboardScope) => registerDashboardRoutes(dashboardScope, dashboardDependencies(repositories, settings, operatorStripe)));
  if (operatorStripe?.webhookReader != null) {
    registerStripeWebhookRoute(server, { reader: operatorStripe.webhookReader, accounts: operatorStripe.accounts });
  }
  registerGateRoutes(server, gates);
  if (settings.demoMode === true) {
    registerDemoConsoleRoutes(server);
  }
  return server;
}

// The dashboard has its own scope, outside the app's: the minimum app version does not apply to a browser.
function dashboardDependencies(
  repositories: ServerDependencies['repositories'],
  settings: ServerSettings,
  operatorStripe: OperatorStripeDependencies | undefined,
): DashboardRouteDependencies {
  return {
    access: { users: repositories.userDirectory, sessions: repositories.sessionTokenRepository },
    operators: repositories.operatorRepository,
    stripe: operatorStripe?.gateway == null ? null : { accounts: operatorStripe.accounts, gateway: operatorStripe.gateway },
    testSignInEnabled: settings.testSignInEnabled === true,
    secureCookies: settings.secureCookies ?? true,
  };
}

// The app's routes share a scope so the minimum app version applies to the app, not to gate controllers or the console.
function registerAppRoutes(server: FastifyInstance, { repositories, cardGateway, entries, spotHolds, testClock, settings }: AppRouteDependencies): void {
  if (settings.minimumAppVersion !== undefined) {
    server.addHook('onRequest', requireMinimumAppVersion(settings.minimumAppVersion));
  }
  const driverAccess: DriverAccess = { drivers: repositories.driverRepository, sessions: repositories.sessionTokenRepository };
  const testTools = testToolsFor(settings, repositories, testClock);
  const clock = testTools?.testClock.now ?? systemClock;
  registerLotsRoutes(server, repositories.lotAvailabilityRepository, driverAccess);
  registerVehicleRoutes(server, repositories.vehicleRepository, driverAccess);
  registerDriverRoutes(server, driverAccess);
  registerPaymentMethodRoutes(server, driverAccess, cardGateway);
  registerEntryRoutes(server, driverAccess, entries);
  registerCurrentParkingSessionRoute(server, driverAccess, { sessions: repositories.currentParkingSessions, clock });
  registerSpotHoldRoutes(server, driverAccess, { services: spotHolds, clock });
  if (testTools !== null) {
    registerTestSignInRoutes(server, { users: repositories.userDirectory, sessions: repositories.sessionTokenRepository });
    registerTestClockRoutes(server, testTools);
  }
}

type AppRouteDependencies = Omit<Required<ServerDependencies>, 'gates' | 'testClock' | 'operatorStripe'> & Pick<ServerDependencies, 'testClock'>;

// Test sign-in is the one switch for every test-only tool: without it sessions and holds run in real time and nothing moves them.
function testToolsFor(
  settings: ServerSettings,
  repositories: ServerDependencies['repositories'],
  testClock: TestClock | undefined,
): TestClockRouteDependencies | null {
  if (settings.testSignInEnabled !== true) {
    return null;
  }
  return { testClock: testClock ?? createTestClock(), backdater: repositories.parkingSessionBackdater };
}

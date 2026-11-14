import Fastify, { type FastifyInstance } from 'fastify';
import type { AccountWebhookReader, OperatorStripeAccounts, OperatorStripeGateway } from '../domain/dashboard/OperatorStripe.ts';
import type { LevelOccupancyReader } from '../domain/dashboard/LevelOccupancyReader.ts';
import type { LotEquipmentReader } from '../domain/dashboard/LotEquipmentReader.ts';
import type { LotMapRepository } from '../domain/dashboard/LotMapRepository.ts';
import type { LotSpotRepository } from '../domain/dashboard/LotSpotRepository.ts';
import type { SpotCheckRepository } from '../domain/dashboard/SpotCheckRepository.ts';
import type { LotSetupRepository } from '../domain/dashboard/LotSetupRepository.ts';
import type { OperatorRepository } from '../domain/dashboard/OperatorRepository.ts';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { DriverAccess } from '../domain/drivers/driverSessions.ts';
import type { CardGateway } from '../domain/payments/CardGateway.ts';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import type { CurrentParkingSessionQuery } from '../domain/parkingSessions/ActiveParkingSession.ts';
import type { ParkedAnswerRepository } from '../domain/parkingSessions/ParkedAnswer.ts';
import type { ParkedPresumptionRepository } from '../domain/parkingSessions/ParkedPresumption.ts';
import type { SpotTakenReportRepository } from '../domain/parkingSessions/SpotTakenReport.ts';
import type { ParkingSessionBackdater } from '../domain/parkingSessions/ParkingSessionBackdater.ts';
import type { ReceiptRepository } from '../domain/receipts/ReceiptRepository.ts';
import type { SessionTokenRepository } from '../domain/sessions/SessionTokenRepository.ts';
import { systemClock, type Clock } from '../domain/time/Clock.ts';
import type { TestClock } from '../domain/time/TestClock.ts';
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
import { registerParkedAnswerRoute } from './routes/parkedAnswerRoute.ts';
import { registerParkedPresumptionRoute } from './routes/parkedPresumptionRoute.ts';
import type { ExitDependencies } from '../domain/exits/exitParking.ts';
import { registerExitRoute } from './routes/exitRoute.ts';
import { registerReceiptRoutes } from './routes/receiptRoutes.ts';
import { registerSpotTakenRoute } from './routes/spotTakenRoute.ts';
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
    readonly lotSetupRepository: LotSetupRepository;
    readonly levelOccupancy: LevelOccupancyReader;
    readonly lotMaps: LotMapRepository;
    readonly lotEquipment: LotEquipmentReader;
    readonly lotSpots: LotSpotRepository;
    readonly spotChecks: SpotCheckRepository;
    readonly currentParkingSessions: CurrentParkingSessionQuery;
    readonly parkingSessionBackdater: ParkingSessionBackdater;
    readonly parkedPresumptions: ParkedPresumptionRepository;
    readonly parkedAnswers: ParkedAnswerRepository;
    readonly spotTakenReports: SpotTakenReportRepository;
    readonly receipts: ReceiptRepository;
  };
  readonly gates: GateRouteDependencies;
  readonly cardGateway?: CardGateway | undefined;
  // main.ts always passes it; tests of other routes leave it out, and entries then answer 503 PAYMENTS_UNAVAILABLE.
  readonly entries?: EntryRouteDependencies | undefined;
  // main.ts always passes it; tests of other routes leave it out, and exits then answer 503 PAYMENTS_UNAVAILABLE.
  readonly exits?: ExitDependencies | undefined;
  // main.ts always passes it; tests of other routes leave it out, and holds then answer 503 HOLD_UNAVAILABLE.
  readonly spotHolds?: SpotHoldServices | undefined;
  // main.ts always passes it; without it the dashboard cannot connect Stripe.
  readonly operatorStripe?: OperatorStripeDependencies | undefined;
  // Required when test sign-in is enabled (composeClock builds it); gates keep their own clock.
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

export function buildServer({ repositories, gates, cardGateway, entries, exits, spotHolds, operatorStripe, testClock, settings = {} }: ServerDependencies): FastifyInstance {
  // Refuse a value of the wrong JSON type rather than converting it, so ["2026-10-28"] is not read as "2026-10-28".
  const server = Fastify({ logger: settings.logsRequests ?? false, ajv: { customOptions: { coerceTypes: false } } });
  server.setErrorHandler(handleServerError);
  server.decorateRequest('driver', null);
  void server.register(async (appScope) => registerAppRoutes(appScope, { repositories, cardGateway, entries, exits, spotHolds, testClock, settings }));
  void server.register(async (dashboardScope) => registerDashboardRoutes(dashboardScope, dashboardDependencies({ repositories, settings, operatorStripe, testClock })));
  if (operatorStripe?.webhookReader != null) {
    registerStripeWebhookRoute(server, { reader: operatorStripe.webhookReader, accounts: operatorStripe.accounts });
  }
  void server.register(async (gateScope) => {
    const composedClock = composedClockOf(settings, repositories, testClock);
    registerGateRoutes(gateScope, gates, { readerExit: exits === undefined ? undefined : { exit: exits, clock: composedClock }, healthClock: composedClock });
  });
  if (settings.demoMode === true) {
    registerDemoConsoleRoutes(server);
  }
  return server;
}

// The dashboard has its own scope, outside the app's: the minimum app version does not apply to a browser.
function dashboardDependencies({ repositories, settings = {}, operatorStripe, testClock }: Omit<ServerDependencies, 'gates'>): DashboardRouteDependencies {
  return {
    access: { users: repositories.userDirectory, sessions: repositories.sessionTokenRepository },
    operators: repositories.operatorRepository,
    lots: repositories.lotSetupRepository,
    occupancy: repositories.levelOccupancy,
    maps: repositories.lotMaps,
    equipment: repositories.lotEquipment,
    clock: composedClockOf(settings, repositories, testClock),
    spots: repositories.lotSpots,
    spotChecks: repositories.spotChecks,
    stripe: operatorStripe?.gateway == null ? null : { accounts: operatorStripe.accounts, gateway: operatorStripe.gateway },
    testSignInEnabled: settings.testSignInEnabled === true,
    secureCookies: settings.secureCookies ?? true,
  };
}

// The app's routes share a scope so the minimum app version applies to the app, not to gate controllers or the console.
function registerAppRoutes(server: FastifyInstance, { repositories, cardGateway, entries, exits, spotHolds, testClock, settings }: AppRouteDependencies): void {
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
  registerParkingSessionRoutes(server, driverAccess, { repositories, clock });
  registerExitRoute(server, driverAccess, exits === undefined ? undefined : { exit: exits, clock });
  registerSpotHoldRoutes(server, driverAccess, { services: spotHolds, clock });
  if (testTools !== null) {
    registerTestSignInRoutes(server, { users: repositories.userDirectory, sessions: repositories.sessionTokenRepository });
    registerTestClockRoutes(server, testTools);
  }
}

interface ParkingSessionRouteDependencies {
  readonly repositories: ServerDependencies['repositories'];
  readonly clock: Clock;
}

// The session in progress, and what the driver tells about it once walking away from the car.
function registerParkingSessionRoutes(server: FastifyInstance, driverAccess: DriverAccess, { repositories, clock }: ParkingSessionRouteDependencies): void {
  registerCurrentParkingSessionRoute(server, driverAccess, { sessions: repositories.currentParkingSessions, clock });
  registerParkedPresumptionRoute(server, driverAccess, repositories.parkedPresumptions);
  registerParkedAnswerRoute(server, driverAccess, repositories.parkedAnswers);
  registerSpotTakenRoute(server, driverAccess, repositories.spotTakenReports);
  registerReceiptRoutes(server, driverAccess, repositories.receipts);
}

type AppRouteDependencies = Omit<Required<ServerDependencies>, 'gates' | 'testClock' | 'operatorStripe'> & Pick<ServerDependencies, 'testClock'>;

// The clock the app's routes share: the test clock exactly when test sign-in is on.
function composedClockOf(settings: ServerSettings, repositories: ServerDependencies['repositories'], testClock: TestClock | undefined): Clock {
  return testToolsFor(settings, repositories, testClock)?.testClock.now ?? systemClock;
}

// Test sign-in is the one switch for every test-only tool: without it sessions and holds run in real time and nothing moves them.
function testToolsFor(
  settings: ServerSettings,
  repositories: ServerDependencies['repositories'],
  testClock: TestClock | undefined,
): TestClockRouteDependencies | null {
  if (settings.testSignInEnabled !== true) {
    return null;
  }
  if (testClock === undefined) {
    throw new Error('Test sign-in needs a test clock: compose it with composeClock.');
  }
  return { testClock, backdater: repositories.parkingSessionBackdater };
}

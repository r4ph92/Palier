import Stripe from 'stripe';
import { readDashboardUrl, readServerEnvironment, readStripeWebhookSecret } from './config/environment.ts';
import { readPaymentsSimulation } from './config/paymentsSimulation.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { exitBeaconWindow } from './domain/exits/identifyByBeacon.ts';
import { composeClock } from './composeClock.ts';
import { composeEntries } from './composeEntries.ts';
import { composeEntryCancellation } from './composeEntryCancellation.ts';
import { composeHoldExpiry } from './composeHoldExpiry.ts';
import { composeSilentSessionPresumption } from './composeSilentSessionPresumption.ts';
import { composeOperatorStripe } from './composeOperatorStripe.ts';
import { composeSpotHolds } from './composeSpotHolds.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresCurrentParkingSessionQuery } from './infrastructure/postgres/PostgresCurrentParkingSessionQuery.ts';
import { PostgresExitRepository } from './infrastructure/postgres/PostgresExitRepository.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresEquipmentReports } from './infrastructure/postgres/PostgresEquipmentReports.ts';
import { PostgresGateCommandFeed } from './infrastructure/postgres/PostgresGateCommandFeed.ts';
import { PostgresGateDeviceKeyRepository } from './infrastructure/postgres/PostgresGateDeviceKeyRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { PostgresLevelOccupancyReader } from './infrastructure/postgres/PostgresLevelOccupancyReader.ts';
import { PostgresLotEquipmentReader } from './infrastructure/postgres/PostgresLotEquipmentReader.ts';
import { PostgresLotMapRepository } from './infrastructure/postgres/PostgresLotMapRepository.ts';
import { PostgresLotSpotRepository } from './infrastructure/postgres/PostgresLotSpotRepository.ts';
import { PostgresSpotCheckRepository } from './infrastructure/postgres/PostgresSpotCheckRepository.ts';
import { PostgresLotSetupRepository } from './infrastructure/postgres/PostgresLotSetupRepository.ts';
import { PostgresOperatorRepository } from './infrastructure/postgres/PostgresOperatorRepository.ts';
import { PostgresParkedAnswerRepository } from './infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { PostgresParkedPresumptionRepository } from './infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { PostgresReceiptRepository } from './infrastructure/postgres/PostgresReceiptRepository.ts';
import { PostgresSpotTakenReportRepository } from './infrastructure/postgres/PostgresSpotTakenReportRepository.ts';
import { PostgresParkingSessionBackdater } from './infrastructure/postgres/PostgresParkingSessionBackdater.ts';
import { PostgresPassageLedger } from './infrastructure/postgres/PostgresPassageLedger.ts';
import { PostgresSessionTokenRepository } from './infrastructure/postgres/PostgresSessionTokenRepository.ts';
import { PostgresUserDirectory } from './infrastructure/postgres/PostgresUserDirectory.ts';
import { StripeCardGateway } from './infrastructure/stripe/StripeCardGateway.ts';
import { PostgresVehicleRepository } from './infrastructure/postgres/PostgresVehicleRepository.ts';
import { openingWindowOf } from './domain/gates/OpeningWindow.ts';
import { presumeSilentSessions } from './domain/parkingSessions/presumeSilentSessions.ts';
import { expireSpotHolds } from './domain/spotHolds/expireSpotHolds.ts';
import { systemClock } from './domain/time/Clock.ts';
import { cancelUnconfirmedEntries, releasePendingHolds } from './domain/entries/unconfirmedEntryCancellation.ts';
import { purgeEndedSessionTokens } from './domain/sessions/sessionTokens.ts';
import { SingleRun, stopAll } from './scheduler/SingleRun.ts';
import { PostgresPendingCaptureRepository } from './infrastructure/postgres/PostgresPendingCaptureRepository.ts';
import { retryCaptures } from './domain/exits/retryCaptures.ts';
import { startRetryCaptures } from './scheduler/startRetryCaptures.ts';
import { startSessionTokenPurge } from './scheduler/startSessionTokenPurge.ts';
import { startUnconfirmedEntryCancellation } from './scheduler/startUnconfirmedEntryCancellation.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl, environment.databasePoolMax);
const stripeKey = stripeTestKey(process.env);
const paymentsSimulation = readPaymentsSimulation(process.env);
const driverRepository = new PostgresDriverRepository(connection.database);
const vehicleRepository = new PostgresVehicleRepository(connection.database);
const sessionTokenRepository = new PostgresSessionTokenRepository(connection.database);
const openingWindow = openingWindowOf(environment.entryCancellation.confirmationWindowSeconds);
const { testClock, clock } = composeClock(environment.testSignInEnabled);
const entries = composeEntries({
  database: connection.database,
  stripeKey,
  demoMode: environment.demoMode,
  paymentsSimulation,
  drivers: driverRepository,
  vehicles: vehicleRepository,
  openingWindow,
  clock,
});
const entryCancellation = composeEntryCancellation(
  { openingWindow, cancellationPeriodSeconds: environment.entryCancellation.cancellationPeriodSeconds, clock },
  connection.database,
  entries.payments,
);
const holdExpiry = composeHoldExpiry({ clock, periodSeconds: environment.holdExpiryPeriodSeconds }, connection.database);
const silentSessionPresumption = composeSilentSessionPresumption(
  { clock, periodSeconds: environment.silentSessionCheckPeriodSeconds },
  connection.database,
);
const server = buildServer({
  repositories: {
    lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
    driverRepository,
    sessionTokenRepository,
    userDirectory: new PostgresUserDirectory(connection.database),
    vehicleRepository,
    operatorRepository: new PostgresOperatorRepository(connection.database),
    lotSetupRepository: new PostgresLotSetupRepository(connection.database),
    levelOccupancy: new PostgresLevelOccupancyReader(connection.database),
    lotMaps: new PostgresLotMapRepository(connection.database),
    lotEquipment: new PostgresLotEquipmentReader(connection.database),
    lotSpots: new PostgresLotSpotRepository(connection.database),
    spotChecks: new PostgresSpotCheckRepository(connection.database),
    currentParkingSessions: new PostgresCurrentParkingSessionQuery(connection.database, exitBeaconWindow),
    parkingSessionBackdater: new PostgresParkingSessionBackdater(connection.database),
    parkedPresumptions: new PostgresParkedPresumptionRepository(connection.database),
    parkedAnswers: new PostgresParkedAnswerRepository(connection.database),
    spotTakenReports: new PostgresSpotTakenReportRepository(connection.database),
    receipts: new PostgresReceiptRepository(connection.database),
  },
  gates: {
    deviceKeys: new PostgresGateDeviceKeyRepository(connection.database),
    ledger: new PostgresPassageLedger(connection.database),
    passageClock: systemClock,
    commands: new PostgresGateCommandFeed(connection.database),
    openingWindow,
    equipment: new PostgresEquipmentReports(connection.database),
  },
  testClock,
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  entries: entries.routes,
  exits: { exits: new PostgresExitRepository(connection.database), payments: entries.payments },
  spotHolds: composeSpotHolds(connection.database, environment.demoMode, { vehicles: vehicleRepository, drivers: driverRepository }),
  operatorStripe: composeOperatorStripe({
    database: connection.database,
    stripeKey,
    webhookSecret: readStripeWebhookSecret(process.env),
    dashboardUrl: readDashboardUrl(process.env),
  }),
  settings: {
    testSignInEnabled: environment.testSignInEnabled,
    demoMode: environment.demoMode,
    logsRequests: true,
    minimumAppVersion: environment.minimumAppVersion,
    secureCookies: environment.secureCookies,
  },
});

if (environment.demoMode) {
  server.log.warn('DEMO_MODE is on: the demo console is served at /demo/console. Never enable it in production.');
}
if (paymentsSimulation === 'unreachable') {
  server.log.warn('PAYMENTS_SIMULATION=unreachable: every entry hold fails as if Stripe were down.');
}
if (paymentsSimulation === 'success') {
  server.log.warn('PAYMENTS_SIMULATION=success: every entry hold succeeds without calling Stripe (pi_sim_ intents).');
}

if (paymentsSimulation === 'capture-unreachable') {
  server.log.warn('PAYMENTS_SIMULATION=capture-unreachable: entry holds succeed, every capture at the exit fails and stays pending.');
}
if (paymentsSimulation === 'surplus-declined') {
  server.log.warn('PAYMENTS_SIMULATION=surplus-declined: holds and captures succeed, the charge beyond the hold at the exit is refused.');
}

const stopSessionTokenPurge = startSessionTokenPurge(() => purgeEndedSessionTokens(sessionTokenRepository, systemClock()), server.log);
// Every API instance may run it: the CREATED guard under the lot lock and Stripe's idempotent cancel make a second run harmless.
const stopEntryCancellation = startUnconfirmedEntryCancellation(
  {
    cancel: () => cancelUnconfirmedEntries(entryCancellation.job, server.log),
    release: () => releasePendingHolds(entryCancellation.job, server.log),
  },
  server.log,
  entryCancellation.periodMilliseconds,
);
// Every API instance runs it too: the lot lock and the ACTIVE guard make a second run find nothing to expire.
const stopHoldExpiry = new SingleRun().startPeriodicTask(() => expireSpotHolds(holdExpiry.job, server.log), {
  logger: server.log,
  failureMessage: 'Expiring spot holds failed',
  periodMilliseconds: holdExpiry.periodMilliseconds,
});
// Every API instance runs it too: the lot lock and the state guards make a second run find nothing to presume.
const stopSilentSessionPresumption = new SingleRun().startPeriodicTask(() => presumeSilentSessions(silentSessionPresumption.job, server.log), {
  logger: server.log,
  failureMessage: 'Presuming silent sessions failed',
  periodMilliseconds: silentSessionPresumption.periodMilliseconds,
});
// Every API instance runs it: the state guard on the paid update and Stripe's idempotency key make a second run take nothing twice.
const captureRetryPayments = entries.payments;
const stopCaptureRetry =
  captureRetryPayments === null
    ? async () => {}
    : startRetryCaptures(
        () => retryCaptures({ pending: new PostgresPendingCaptureRepository(connection.database), payments: captureRetryPayments }, server.log),
        server.log,
      );
server.addHook('onClose', async () => {
  await stopAll([stopSilentSessionPresumption, stopHoldExpiry, stopEntryCancellation, stopSessionTokenPurge, stopCaptureRetry]);
  await connection.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

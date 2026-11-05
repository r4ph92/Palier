import Stripe from 'stripe';
import { readDashboardUrl, readServerEnvironment, readStripeWebhookSecret } from './config/environment.ts';
import { readPaymentsSimulation } from './config/paymentsSimulation.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { composeEntries } from './composeEntries.ts';
import { composeEntryCancellation } from './composeEntryCancellation.ts';
import { composeOperatorStripe } from './composeOperatorStripe.ts';
import { composeSpotHolds } from './composeSpotHolds.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresCurrentParkingSessionQuery } from './infrastructure/postgres/PostgresCurrentParkingSessionQuery.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresGateCommandFeed } from './infrastructure/postgres/PostgresGateCommandFeed.ts';
import { PostgresGateDeviceKeyRepository } from './infrastructure/postgres/PostgresGateDeviceKeyRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { PostgresOperatorRepository } from './infrastructure/postgres/PostgresOperatorRepository.ts';
import { PostgresParkingSessionBackdater } from './infrastructure/postgres/PostgresParkingSessionBackdater.ts';
import { PostgresPassageLedger } from './infrastructure/postgres/PostgresPassageLedger.ts';
import { PostgresSessionTokenRepository } from './infrastructure/postgres/PostgresSessionTokenRepository.ts';
import { PostgresUserDirectory } from './infrastructure/postgres/PostgresUserDirectory.ts';
import { StripeCardGateway } from './infrastructure/stripe/StripeCardGateway.ts';
import { PostgresVehicleRepository } from './infrastructure/postgres/PostgresVehicleRepository.ts';
import { openingWindowOf } from './domain/gates/OpeningWindow.ts';
import { systemClock } from './domain/time/Clock.ts';
import { cancelUnconfirmedEntries, releasePendingHolds } from './domain/entries/unconfirmedEntryCancellation.ts';
import { purgeEndedSessionTokens } from './domain/sessions/sessionTokens.ts';
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
const entries = composeEntries({
  database: connection.database,
  stripeKey,
  demoMode: environment.demoMode,
  paymentsSimulation,
  drivers: driverRepository,
  vehicles: vehicleRepository,
  openingWindow,
});
const entryCancellation = composeEntryCancellation(
  { openingWindow, cancellationPeriodSeconds: environment.entryCancellation.cancellationPeriodSeconds },
  connection.database,
  entries.payments,
);
const server = buildServer({
  repositories: {
    lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
    driverRepository,
    sessionTokenRepository,
    userDirectory: new PostgresUserDirectory(connection.database),
    vehicleRepository,
    operatorRepository: new PostgresOperatorRepository(connection.database),
    currentParkingSessions: new PostgresCurrentParkingSessionQuery(connection.database),
    parkingSessionBackdater: new PostgresParkingSessionBackdater(connection.database),
  },
  gates: {
    deviceKeys: new PostgresGateDeviceKeyRepository(connection.database),
    ledger: new PostgresPassageLedger(connection.database),
    clock: systemClock,
    commands: new PostgresGateCommandFeed(connection.database),
    openingWindow,
  },
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  entries: entries.routes,
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
server.addHook('onClose', async () => {
  await stopEntryCancellation();
  await stopSessionTokenPurge();
  await connection.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

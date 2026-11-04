import Stripe from 'stripe';
import { readDashboardUrl, readServerEnvironment, readSimulateStripeUnreachable, readStripeWebhookSecret } from './config/environment.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { composeEntries } from './composeEntries.ts';
import { composeOperatorStripe } from './composeOperatorStripe.ts';
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
import { systemClock } from './domain/time/Clock.ts';
import { purgeEndedSessionTokens } from './domain/sessions/sessionTokens.ts';
import { startSessionTokenPurge } from './scheduler/startSessionTokenPurge.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl);
const stripeKey = stripeTestKey(process.env);
const simulateStripeUnreachable = readSimulateStripeUnreachable(process.env);
const driverRepository = new PostgresDriverRepository(connection.database);
const vehicleRepository = new PostgresVehicleRepository(connection.database);
const sessionTokenRepository = new PostgresSessionTokenRepository(connection.database);
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
  },
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  entries: composeEntries({
    database: connection.database,
    stripeKey,
    demoMode: environment.demoMode,
    simulateStripeUnreachable,
    drivers: driverRepository,
    vehicles: vehicleRepository,
  }),
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
if (simulateStripeUnreachable) {
  server.log.warn('SIMULATE_STRIPE_UNREACHABLE is on: every entry hold fails as if Stripe were down.');
}

const stopSessionTokenPurge = startSessionTokenPurge(() => purgeEndedSessionTokens(sessionTokenRepository, systemClock()), server.log);
server.addHook('onClose', async () => {
  await stopSessionTokenPurge();
  await connection.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

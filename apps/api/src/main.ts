import Stripe from 'stripe';
import { readServerEnvironment } from './config/environment.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresGateDeviceKeyRepository } from './infrastructure/postgres/PostgresGateDeviceKeyRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { PostgresPassageLedger } from './infrastructure/postgres/PostgresPassageLedger.ts';
import { StripeCardGateway } from './infrastructure/stripe/StripeCardGateway.ts';
import { PostgresVehicleRepository } from './infrastructure/postgres/PostgresVehicleRepository.ts';
import { purgeEndedSessionTokens } from './domain/drivers/driverSessions.ts';
import { startSessionTokenPurge } from './scheduler/startSessionTokenPurge.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl);
const stripeKey = stripeTestKey(process.env);
const driverRepository = new PostgresDriverRepository(connection.database);
const server = buildServer({
  repositories: {
    lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
    driverRepository,
    vehicleRepository: new PostgresVehicleRepository(connection.database),
  },
  gates: {
    deviceKeys: new PostgresGateDeviceKeyRepository(connection.database),
    ledger: new PostgresPassageLedger(connection.database),
    clock: () => new Date(),
  },
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  settings: {
    testSignInEnabled: environment.testSignInEnabled,
    demoMode: environment.demoMode,
    logsRequests: true,
    minimumAppVersion: environment.minimumAppVersion,
  },
});

if (environment.demoMode) {
  server.log.warn('DEMO_MODE is on: the demo console is served at /demo/console. Never enable it in production.');
}

const stopSessionTokenPurge = startSessionTokenPurge(() => purgeEndedSessionTokens(driverRepository, new Date()), server.log);
server.addHook('onClose', async () => {
  await stopSessionTokenPurge();
  await connection.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

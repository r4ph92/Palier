import Stripe from 'stripe';
import { readServerEnvironment } from './config/environment.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
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
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  settings: {
    testSignInEnabled: environment.testSignInEnabled,
    logsRequests: true,
    minimumAppVersion: environment.minimumAppVersion,
  },
});

const stopSessionTokenPurge = startSessionTokenPurge(() => purgeEndedSessionTokens(driverRepository, new Date()), server.log);
server.addHook('onClose', async () => {
  await stopSessionTokenPurge();
  await connection.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

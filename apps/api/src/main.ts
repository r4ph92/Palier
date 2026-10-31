import Stripe from 'stripe';
import { readServerEnvironment } from './config/environment.ts';
import { stripeTestKey } from './config/stripeTestKey.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { StripeCardGateway } from './infrastructure/stripe/StripeCardGateway.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl);
const stripeKey = stripeTestKey(process.env);
const server = buildServer({
  lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
  driverRepository: new PostgresDriverRepository(connection.database),
  cardGateway: stripeKey === null ? undefined : new StripeCardGateway(new Stripe(stripeKey)),
  testSignInEnabled: environment.testSignInEnabled,
  logsRequests: true,
});

server.addHook('onClose', () => connection.close());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

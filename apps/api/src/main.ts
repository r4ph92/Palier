import { readServerEnvironment } from './config/environment.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresDriverRepository } from './infrastructure/postgres/PostgresDriverRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl);
const server = buildServer({
  lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
  driverRepository: new PostgresDriverRepository(connection.database),
  testSignInEnabled: environment.testSignInEnabled,
  logsRequests: true,
});

server.addHook('onClose', () => connection.close());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

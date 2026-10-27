import { readServerEnvironment } from './config/environment.ts';
import { buildServer } from './http/buildServer.ts';
import { connectToDatabase } from './infrastructure/postgres/database.ts';
import { PostgresGateDeviceKeyRepository } from './infrastructure/postgres/PostgresGateDeviceKeyRepository.ts';
import { PostgresLotAvailabilityRepository } from './infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { PostgresPassageLedger } from './infrastructure/postgres/PostgresPassageLedger.ts';

const environment = readServerEnvironment(process.env);
const connection = connectToDatabase(environment.databaseUrl);
const server = buildServer({
  lotAvailabilityRepository: new PostgresLotAvailabilityRepository(connection.database),
  gates: {
    deviceKeys: new PostgresGateDeviceKeyRepository(connection.database),
    ledger: new PostgresPassageLedger(connection.database),
    clock: () => new Date(),
  },
  demoMode: environment.demoMode,
  logsRequests: true,
});

if (environment.demoMode) {
  server.log.warn('DEMO_MODE is on: the demo console is served at /demo/console. Never enable it in production.');
}

server.addHook('onClose', () => connection.close());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}

await server.listen({ host: environment.host, port: environment.port });

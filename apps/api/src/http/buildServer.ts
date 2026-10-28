import Fastify, { type FastifyInstance } from 'fastify';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import { handleServerError } from './handleServerError.ts';
import { registerDriverRoutes } from './routes/driverRoutes.ts';
import { registerLotsRoutes } from './routes/lotsRoutes.ts';
import { registerTestSignInRoutes } from './routes/testSignInRoutes.ts';

export interface ServerDependencies {
  readonly lotAvailabilityRepository: LotAvailabilityRepository;
  readonly driverRepository: DriverRepository;
  readonly testSignInEnabled?: boolean;
  readonly logsRequests?: boolean;
}

export function buildServer(dependencies: ServerDependencies): FastifyInstance {
  // Refuse a value of the wrong JSON type rather than converting it, so ["2026-10-28"] is not read as "2026-10-28".
  const server = Fastify({ logger: dependencies.logsRequests ?? false, ajv: { customOptions: { coerceTypes: false } } });
  server.setErrorHandler(handleServerError);
  server.decorateRequest('driver', null);
  registerLotsRoutes(server, dependencies.lotAvailabilityRepository, dependencies.driverRepository);
  registerDriverRoutes(server, dependencies.driverRepository);
  if (dependencies.testSignInEnabled === true) {
    registerTestSignInRoutes(server, dependencies.driverRepository);
  }
  return server;
}

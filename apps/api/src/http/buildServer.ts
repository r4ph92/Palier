import Fastify, { type FastifyInstance } from 'fastify';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { CardGateway } from '../domain/payments/CardGateway.ts';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import type { VehicleRepository } from '../domain/vehicles/VehicleRepository.ts';
import { handleServerError } from './handleServerError.ts';
import { registerDriverRoutes } from './routes/driverRoutes.ts';
import { registerLotsRoutes } from './routes/lotsRoutes.ts';
import { registerPaymentMethodRoutes } from './routes/paymentMethodRoutes.ts';
import { registerVehicleRoutes } from './routes/vehicleRoutes.ts';
import { registerTestSignInRoutes } from './routes/testSignInRoutes.ts';

export interface ServerDependencies {
  readonly repositories: {
    readonly lotAvailabilityRepository: LotAvailabilityRepository;
    readonly driverRepository: DriverRepository;
    readonly vehicleRepository: VehicleRepository;
  };
  readonly cardGateway?: CardGateway | undefined;
  readonly testSignInEnabled?: boolean;
  readonly logsRequests?: boolean;
}

export function buildServer({ repositories, cardGateway, testSignInEnabled, logsRequests }: ServerDependencies): FastifyInstance {
  // Refuse a value of the wrong JSON type rather than converting it, so ["2026-10-28"] is not read as "2026-10-28".
  const server = Fastify({ logger: logsRequests ?? false, ajv: { customOptions: { coerceTypes: false } } });
  server.setErrorHandler(handleServerError);
  server.decorateRequest('driver', null);
  registerLotsRoutes(server, repositories.lotAvailabilityRepository, repositories.driverRepository);
  registerVehicleRoutes(server, repositories.vehicleRepository, repositories.driverRepository);
  registerDriverRoutes(server, repositories.driverRepository);
  registerPaymentMethodRoutes(server, repositories.driverRepository, cardGateway);
  if (testSignInEnabled === true) {
    registerTestSignInRoutes(server, repositories.driverRepository);
  }
  return server;
}

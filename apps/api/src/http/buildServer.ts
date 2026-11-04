import Fastify, { type FastifyInstance } from 'fastify';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { CardGateway } from '../domain/payments/CardGateway.ts';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import type { VehicleRepository } from '../domain/vehicles/VehicleRepository.ts';
import { registerDemoConsoleRoutes } from './demo/demoConsoleRoutes.ts';
import { handleServerError } from './handleServerError.ts';
import { requireMinimumAppVersion } from './requireMinimumAppVersion.ts';
import { registerDriverRoutes } from './routes/driverRoutes.ts';
import { registerEntryRoutes, type EntryRouteDependencies } from './routes/entryRoutes.ts';
import { registerGateRoutes, type GateRouteDependencies } from './routes/gateRoutes.ts';
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
  readonly gates: GateRouteDependencies;
  readonly cardGateway?: CardGateway | undefined;
  // main.ts always passes it; tests of other routes leave it out, and entries then answer 503 PAYMENTS_UNAVAILABLE.
  readonly entries?: EntryRouteDependencies | undefined;
  readonly settings?: ServerSettings;
}

export interface ServerSettings {
  readonly testSignInEnabled?: boolean;
  readonly demoMode?: boolean;
  readonly logsRequests?: boolean;
  readonly minimumAppVersion?: string | undefined;
}

export function buildServer({ repositories, gates, cardGateway, entries, settings = {} }: ServerDependencies): FastifyInstance {
  // Refuse a value of the wrong JSON type rather than converting it, so ["2026-10-28"] is not read as "2026-10-28".
  const server = Fastify({ logger: settings.logsRequests ?? false, ajv: { customOptions: { coerceTypes: false } } });
  server.setErrorHandler(handleServerError);
  server.decorateRequest('driver', null);
  void server.register(async (appScope) => registerAppRoutes(appScope, { repositories, cardGateway, entries, settings }));
  registerGateRoutes(server, gates);
  if (settings.demoMode === true) {
    registerDemoConsoleRoutes(server);
  }
  return server;
}

// The app's routes share a scope so the minimum app version applies to the app, not to gate controllers or the console.
function registerAppRoutes(
  server: FastifyInstance,
  { repositories, cardGateway, entries, settings }: Omit<Required<ServerDependencies>, 'gates'>,
): void {
  if (settings.minimumAppVersion !== undefined) {
    server.addHook('onRequest', requireMinimumAppVersion(settings.minimumAppVersion));
  }
  registerLotsRoutes(server, repositories.lotAvailabilityRepository, repositories.driverRepository);
  registerVehicleRoutes(server, repositories.vehicleRepository, repositories.driverRepository);
  registerDriverRoutes(server, repositories.driverRepository);
  registerPaymentMethodRoutes(server, repositories.driverRepository, cardGateway);
  registerEntryRoutes(server, repositories.driverRepository, entries);
  if (settings.testSignInEnabled === true) {
    registerTestSignInRoutes(server, repositories.driverRepository);
  }
}

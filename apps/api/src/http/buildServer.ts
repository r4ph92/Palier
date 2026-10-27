import Fastify, { type FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import { handleServerError } from './handleServerError.ts';
import { registerGateRoutes, type GateRouteDependencies } from './routes/gateRoutes.ts';
import { registerLotsRoutes } from './routes/lotsRoutes.ts';

export interface ServerDependencies {
  readonly lotAvailabilityRepository: LotAvailabilityRepository;
  readonly gates: GateRouteDependencies;
  readonly logsRequests?: boolean;
}

export function buildServer(dependencies: ServerDependencies): FastifyInstance {
  const server = Fastify({ logger: dependencies.logsRequests ?? false });
  server.setErrorHandler(handleServerError);
  registerLotsRoutes(server, dependencies.lotAvailabilityRepository);
  registerGateRoutes(server, dependencies.gates);
  return server;
}

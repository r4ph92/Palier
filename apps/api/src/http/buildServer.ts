import Fastify, { type FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../domain/lots/LotAvailabilityRepository.ts';
import { registerLotsRoutes } from './routes/lotsRoutes.ts';

export interface ServerDependencies {
  readonly lotAvailabilityRepository: LotAvailabilityRepository;
}

export function buildServer(dependencies: ServerDependencies, logger = false): FastifyInstance {
  const server = Fastify({ logger });
  registerLotsRoutes(server, dependencies.lotAvailabilityRepository);
  return server;
}

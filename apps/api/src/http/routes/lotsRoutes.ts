import type { LotListResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import { listOnlineLots } from '../../domain/lots/listOnlineLots.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { lotListResponseSchema } from '../schemas/lotListResponseSchema.ts';

export function registerLotsRoutes(
  server: FastifyInstance,
  repository: LotAvailabilityRepository,
  driverAccess: DriverAccess,
): void {
  server.get(
    '/v1/lots',
    { preHandler: consentedDriverGuards(driverAccess), schema: { response: { 200: lotListResponseSchema } } },
    async (request): Promise<LotListResponse> => listOnlineLots(repository, request.log),
  );
}

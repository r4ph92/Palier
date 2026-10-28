import type { LotListResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import { listOnlineLots } from '../../domain/lots/listOnlineLots.ts';
import { requireDriver } from '../requireDriver.ts';
import { lotListResponseSchema } from '../schemas/lotListResponseSchema.ts';

export function registerLotsRoutes(
  server: FastifyInstance,
  repository: LotAvailabilityRepository,
  driverRepository: DriverRepository,
): void {
  server.get(
    '/v1/lots',
    { preHandler: requireDriver(driverRepository), schema: { response: { 200: lotListResponseSchema } } },
    async (): Promise<LotListResponse> => listOnlineLots(repository),
  );
}

import type { LotListResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import { listOnlineLots } from '../../domain/lots/listOnlineLots.ts';

const lotListResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'freeSpots'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      freeSpots: { type: 'integer' },
    },
  },
} as const;

export function registerLotsRoutes(server: FastifyInstance, repository: LotAvailabilityRepository): void {
  server.get('/v1/lots', { schema: { response: { 200: lotListResponseSchema } } }, async (): Promise<LotListResponse> => {
    return listOnlineLots(repository);
  });
}

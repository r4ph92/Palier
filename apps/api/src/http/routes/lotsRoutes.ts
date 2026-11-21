import type { LotListResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { LotAvailabilityRepository } from '../../domain/lots/LotAvailabilityRepository.ts';
import { listOnlineLots } from '../../domain/lots/listOnlineLots.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { lotListResponseSchema } from '../schemas/lotListResponseSchema.ts';

const BAD_REQUEST = 400;

interface LotsRoute {
  Querystring: Readonly<Record<string, unknown>>;
}

// The position never reaches the API (decision 015): any query parameter is refused, after the driver and consent checks.
export function registerLotsRoutes(
  server: FastifyInstance,
  repository: LotAvailabilityRepository,
  driverAccess: DriverAccess,
): void {
  server.get<LotsRoute>(
    '/v1/lots',
    { preHandler: consentedDriverGuards(driverAccess), schema: { response: { 200: lotListResponseSchema } } },
    async (request, reply): Promise<LotListResponse> => {
      if (Object.keys(request.query).length > 0) {
        return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'QUERY_NOT_ALLOWED', message: 'The lot list takes no query parameters.' });
      }
      return listOnlineLots(repository);
    },
  );
}

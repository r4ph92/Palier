import type { DriverProfile } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { signOutDriver } from '../../domain/drivers/driverSessions.ts';
import { bearerToken, requireDriver, signedInDriver } from '../requireDriver.ts';
import { driverProfileSchema } from '../schemas/driverSchemas.ts';

const NO_CONTENT = 204;

export function registerDriverRoutes(server: FastifyInstance, repository: DriverRepository): void {
  const preHandler = requireDriver(repository);

  server.get('/v1/me', { preHandler, schema: { response: { 200: driverProfileSchema } } }, async (request): Promise<DriverProfile> => {
    const driver = signedInDriver(request);
    return { id: driver.id, firstName: driver.firstName };
  });

  server.post('/v1/sign-out', { preHandler }, async (request, reply) => {
    await signOutDriver(repository, bearerToken(request) ?? '');
    return reply.status(NO_CONTENT).send();
  });
}

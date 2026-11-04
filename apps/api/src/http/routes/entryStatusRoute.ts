import type { FastifyInstance } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { ParkingSessionRepository } from '../../domain/entries/ParkingSessionRepository.ts';
import { requireConsent } from '../requireConsent.ts';
import { requireDriver, signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, entryStatusResponseSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';

const NOT_FOUND = 404;

interface StatusRoute {
  readonly Params: EntrySessionParameters;
}

// The app polls this after the barrier opens, until the entry loop confirms the car.
export function registerEntryStatusRoute(
  server: FastifyInstance,
  driverRepository: DriverRepository,
  sessions: ParkingSessionRepository | undefined,
): void {
  const onRequest = [requireDriver(driverRepository), requireConsent(driverRepository)];
  const schema = { params: entrySessionParametersSchema, response: { 200: entryStatusResponseSchema } };
  server.get<StatusRoute>('/v1/entries/:sessionId', { onRequest, schema }, async (request, reply) => {
    const status = await sessions?.findForUser(request.params.sessionId, signedInDriver(request).id);
    if (status === undefined || status === null) {
      return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'SESSION_NOT_FOUND', message: 'No such entry.' });
    }
    return status;
  });
}

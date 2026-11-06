import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkingSessionRepository } from '../../domain/entries/ParkingSessionRepository.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, entryStatusResponseSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';

interface StatusRoute {
  readonly Params: EntrySessionParameters;
}

// The app polls this after the barrier opens, until the entry loop confirms the car.
export function registerEntryStatusRoute(
  server: FastifyInstance,
  driverAccess: DriverAccess,
  sessions: ParkingSessionRepository | undefined,
): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, response: { 200: entryStatusResponseSchema } };
  server.get<StatusRoute>('/v1/entries/:sessionId', { onRequest, schema }, async (request, reply) => {
    const status = await sessions?.findForUser(request.params.sessionId, signedInDriver(request).id);
    if (status === undefined || status === null) {
      return reply.status(SESSION_NOT_FOUND_BODY.statusCode).send(SESSION_NOT_FOUND_BODY);
    }
    return {
      sessionId: status.id,
      state: status.state,
      spot: status.spot,
      entryConfirmedAt: status.entryConfirmedAt?.toISOString() ?? null,
    };
  });
}

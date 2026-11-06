import type { ParkedPresumptionRefusalCode, ParkedPresumptionRequest, ParkedPresumptionResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkedPresumption, ParkedPresumptionRepository } from '../../domain/parkingSessions/ParkedPresumption.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { parkedPresumptionRequestSchema, parkedPresumptionResponseSchema } from '../schemas/parkingSessionSchemas.ts';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

interface ParkedRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: ParkedPresumptionRequest;
}

interface Refusal {
  readonly statusCode: number;
  readonly error: ParkedPresumptionRefusalCode;
  readonly message: string;
}

// Same body as GET /v1/entries/:sessionId, so another driver's session cannot be told from an unknown id.
const REFUSALS: Record<Exclude<ParkedPresumption['outcome'], 'presumed' | 'already'>, Refusal> = {
  'not-found': { statusCode: NOT_FOUND, error: 'SESSION_NOT_FOUND', message: 'No such entry.' },
  'entry-not-confirmed': { statusCode: CONFLICT, error: 'ENTRY_NOT_CONFIRMED', message: 'The entry loop has not confirmed this session yet.' },
  closed: { statusCode: CONFLICT, error: 'SESSION_CLOSED', message: 'This session is closed.' },
};

// The app sends this when the device sees the driver walk away from the car (Q36, decision 019).
export function registerParkedPresumptionRoute(server: FastifyInstance, driverAccess: DriverAccess, presumptions: ParkedPresumptionRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: parkedPresumptionRequestSchema, response: { 200: parkedPresumptionResponseSchema } };
  server.post<ParkedRoute>('/v1/entries/:sessionId/parked', { onRequest, schema }, (request, reply) => presume(presumptions, request, reply));
}

async function presume(
  presumptions: ParkedPresumptionRepository,
  request: FastifyRequest<ParkedRoute>,
  reply: FastifyReply,
): Promise<ParkedPresumptionResponse | FastifyReply> {
  const detectedAt = new Date(request.body.detectedAt);
  // The schema's date-time format admits a leap second, which Date cannot hold.
  if (Number.isNaN(detectedAt.getTime())) {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'detectedAt is not a valid date.' });
  }
  const presumption = await presumptions.presume({ sessionId: request.params.sessionId, driverId: signedInDriver(request).id, detectedAt });
  if (presumption.outcome === 'presumed' || presumption.outcome === 'already') {
    return { state: 'PARKED_PRESUMED', parkedAt: presumption.parkedAt.toISOString() };
  }
  const refusal = REFUSALS[presumption.outcome];
  return reply.status(refusal.statusCode).send(refusal);
}

import type { ParkedPresumptionRefusalCode, ParkedPresumptionRequest, ParkedPresumptionResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkedPresumption, ParkedPresumptionRepository } from '../../domain/parkingSessions/ParkedPresumption.ts';
import { isStorableDate } from '../../domain/time/storableDate.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { SESSION_NOT_FOUND_BODY } from './entryStatusRoute.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { parkedPresumptionRequestSchema, parkedPresumptionResponseSchema } from '../schemas/parkingSessionSchemas.ts';

const BAD_REQUEST = 400;
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

// The 404 is GET /v1/entries/:sessionId's, so another driver's session cannot be told from an unknown id.
const REFUSALS: Record<Exclude<ParkedPresumption['outcome'], 'presumed' | 'already'>, Refusal> = {
  'not-found': SESSION_NOT_FOUND_BODY,
  'entry-not-confirmed': { statusCode: CONFLICT, error: 'ENTRY_NOT_CONFIRMED', message: 'The entry loop has not confirmed this session yet.' },
  closed: { statusCode: CONFLICT, error: 'SESSION_CLOSED', message: 'This session is closed.' },
};

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
  // The schema's date-time format admits a leap second, which Date cannot hold, and year 0000, which Postgres cannot.
  if (!isStorableDate(detectedAt)) {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'detectedAt is not a valid date.' });
  }
  const presumption = await presumptions.presume({ sessionId: request.params.sessionId, driverId: signedInDriver(request).id, detectedAt });
  if (presumption.outcome === 'presumed' || presumption.outcome === 'already') {
    return { state: 'PARKED_PRESUMED', parkedAt: presumption.parkedAt.toISOString() };
  }
  const refusal = REFUSALS[presumption.outcome];
  return reply.status(refusal.statusCode).send(refusal);
}

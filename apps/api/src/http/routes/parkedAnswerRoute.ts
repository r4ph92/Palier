import type { ParkedSpotAnswerRefusalCode, ParkedSpotAnswerRequest, ParkedSpotAnswerResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkedAnswerRefusal, ParkedAnswerRepository } from '../../domain/parkingSessions/ParkedAnswer.ts';
import { normalizeSpotNumber } from '../../domain/spots/normalizeSpotNumber.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { parkedSpotAnswerRequestSchema, parkedSpotAnswerResponseSchema } from '../schemas/parkingSessionSchemas.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';

const BAD_REQUEST = 400;
const CONFLICT = 409;
const SERVICE_UNAVAILABLE = 503;

interface AnswerRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: ParkedSpotAnswerRequest;
}

interface Refusal {
  readonly statusCode: number;
  readonly error: ParkedSpotAnswerRefusalCode;
  readonly message: string;
}

const REFUSALS: Record<ParkedAnswerRefusal, Refusal> = {
  'not-found': SESSION_NOT_FOUND_BODY,
  'not-asked': { statusCode: CONFLICT, error: 'NOT_ASKED', message: 'This session is not waiting for a spot number.' },
  closed: { statusCode: CONFLICT, error: 'SESSION_CLOSED', message: 'This session is closed.' },
  'unknown-spot': { statusCode: CONFLICT, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' },
  'spot-taken': { statusCode: CONFLICT, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' },
  'spot-out-of-service': { statusCode: CONFLICT, error: 'SPOT_OUT_OF_SERVICE', message: 'This spot is out of service.' },
  'lot-busy': { statusCode: SERVICE_UNAVAILABLE, error: 'LOT_BUSY', message: 'The parking lot is busy; try again.' },
};

// Story #21: the driver walked away in another aisle and says which spot the car is in.
export function registerParkedAnswerRoute(server: FastifyInstance, driverAccess: DriverAccess, answers: ParkedAnswerRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: parkedSpotAnswerRequestSchema, response: { 200: parkedSpotAnswerResponseSchema } };
  server.post<AnswerRoute>('/v1/entries/:sessionId/spot', { onRequest, schema }, (request, reply) => answer(answers, request, reply));
}

async function answer(answers: ParkedAnswerRepository, request: FastifyRequest<AnswerRoute>, reply: FastifyReply): Promise<ParkedSpotAnswerResponse | FastifyReply> {
  const spotNumber = normalizeSpotNumber(request.body.spotNumber);
  if (spotNumber === '') {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'spotNumber is blank.' });
  }
  const { sessionId } = request.params;
  const answered = await answers.answer({ sessionId, driverId: signedInDriver(request).id, spotNumber });
  if (answered.outcome === 'confirmed' || answered.outcome === 'already') {
    return { state: 'PARKED_CONFIRMED', spot: answered.spot };
  }
  if (answered.outcome === 'lot-busy') {
    request.log.warn({ sessionId }, 'spot answer refused: the lot stayed locked past the lock timeout');
  }
  const refusal = REFUSALS[answered.outcome];
  return reply.status(refusal.statusCode).send(refusal);
}

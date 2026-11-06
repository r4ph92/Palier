import type { ParkedSpotAnswerRefusalCode, ParkedSpotAnswerRequest, ParkedSpotAnswerResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkedAnswerRefusal, ParkedAnswerRepository } from '../../domain/parkingSessions/ParkedAnswer.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { parkedSpotAnswerRequestSchema, parkedSpotAnswerResponseSchema } from '../schemas/parkingSessionSchemas.ts';
import { isBlankSpotNumber, LOT_BUSY_BODY, refusalSender, replyBlankSpotNumber, SESSION_CLOSED_BODY } from '../parkedRefusals.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';

const CONFLICT = 409;

interface AnswerRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: ParkedSpotAnswerRequest;
}

const sendRefusal = refusalSender<ParkedAnswerRefusal, ParkedSpotAnswerRefusalCode>(
  {
    'not-found': SESSION_NOT_FOUND_BODY,
    'not-asked': { statusCode: CONFLICT, error: 'NOT_ASKED', message: 'This session is not waiting for a spot number.' },
    closed: SESSION_CLOSED_BODY,
    'unknown-spot': { statusCode: CONFLICT, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' },
    'spot-taken': { statusCode: CONFLICT, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' },
    'spot-out-of-service': { statusCode: CONFLICT, error: 'SPOT_OUT_OF_SERVICE', message: 'This spot is out of service.' },
    'lot-busy': LOT_BUSY_BODY,
  },
  'spot answer',
);

// The driver walked away in another aisle and says which spot the car is in.
export function registerParkedAnswerRoute(server: FastifyInstance, driverAccess: DriverAccess, answers: ParkedAnswerRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: parkedSpotAnswerRequestSchema, response: { 200: parkedSpotAnswerResponseSchema } };
  server.post<AnswerRoute>('/v1/entries/:sessionId/spot', { onRequest, schema }, (request, reply) => answer(answers, request, reply));
}

async function answer(answers: ParkedAnswerRepository, request: FastifyRequest<AnswerRoute>, reply: FastifyReply): Promise<ParkedSpotAnswerResponse | FastifyReply> {
  const spotNumber = request.body.spotNumber.trim();
  if (isBlankSpotNumber(spotNumber)) {
    return replyBlankSpotNumber(reply);
  }
  const answered = await answers.answer({ sessionId: request.params.sessionId, driverId: signedInDriver(request).id, spotNumber });
  if (answered.outcome === 'confirmed' || answered.outcome === 'already') {
    return { state: 'PARKED_CONFIRMED', spot: answered.spot };
  }
  return sendRefusal(answered.outcome, request, reply);
}

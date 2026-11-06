import type { SpotTakenRefusalCode, SpotTakenRequest, SpotTakenResponse } from '@palier/shared-types';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { SpotTakenRefusal, SpotTakenReportRepository } from '../../domain/parkingSessions/SpotTakenReport.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { spotTakenRequestSchema, spotTakenResponseSchema } from '../schemas/parkingSessionSchemas.ts';
import { LOT_BUSY_BODY, SESSION_CLOSED_BODY } from '../parkedRefusals.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';

const BAD_REQUEST = 400;
const CONFLICT = 409;

interface SpotTakenRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: SpotTakenRequest;
}

interface Refusal {
  readonly statusCode: number;
  readonly error: SpotTakenRefusalCode;
  readonly message: string;
}

const REFUSALS: Record<SpotTakenRefusal, Refusal> = {
  'not-found': SESSION_NOT_FOUND_BODY,
  'entry-not-confirmed': { statusCode: CONFLICT, error: 'ENTRY_NOT_CONFIRMED', message: 'This entry is not confirmed yet.' },
  'already-parked': { statusCode: CONFLICT, error: 'ALREADY_PARKED', message: 'This session is already parked.' },
  closed: SESSION_CLOSED_BODY,
  'spot-not-assigned': { statusCode: CONFLICT, error: 'SPOT_NOT_ASSIGNED', message: 'This spot is not the one assigned to this session.' },
  'lot-busy': LOT_BUSY_BODY,
};

// The driver found a car in their assigned spot before parking, and asks for another one.
export function registerSpotTakenRoute(server: FastifyInstance, driverAccess: DriverAccess, reports: SpotTakenReportRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: spotTakenRequestSchema, response: { 200: spotTakenResponseSchema } };
  server.post<SpotTakenRoute>('/v1/entries/:sessionId/spot-taken', { onRequest, schema }, (request, reply) => report(reports, request, reply));
}

async function report(reports: SpotTakenReportRepository, request: FastifyRequest<SpotTakenRoute>, reply: FastifyReply): Promise<SpotTakenResponse | FastifyReply> {
  const spotNumber = request.body.spotNumber.trim();
  if (canonicalSpotNumber(spotNumber) === '') {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'spotNumber is blank.' });
  }
  const { sessionId } = request.params;
  const reported = await reports.report({ sessionId, driverId: signedInDriver(request).id, spotNumber });
  if (reported.outcome === 'reassigned' || reported.outcome === 'none-free') {
    return reported;
  }
  if (reported.outcome === 'lot-busy') {
    request.log.warn({ sessionId }, 'spot-taken report refused: the lot stayed locked past the lock timeout');
  }
  const refusal = REFUSALS[reported.outcome];
  return reply.status(refusal.statusCode).send(refusal);
}

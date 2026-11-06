import type { SpotTakenRefusalCode, SpotTakenRequest, SpotTakenResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { SpotTakenRefusal, SpotTakenReportRepository } from '../../domain/parkingSessions/SpotTakenReport.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { spotTakenRequestSchema, spotTakenResponseSchema } from '../schemas/parkingSessionSchemas.ts';
import { ENTRY_NOT_CONFIRMED_BODY, isBlankSpotNumber, LOT_BUSY_BODY, refusalSender, replyBlankSpotNumber, SESSION_CLOSED_BODY } from '../parkedRefusals.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';

const CONFLICT = 409;

interface SpotTakenRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: SpotTakenRequest;
}

const sendRefusal = refusalSender<SpotTakenRefusal, SpotTakenRefusalCode>(
  {
    'not-found': SESSION_NOT_FOUND_BODY,
    'entry-not-confirmed': ENTRY_NOT_CONFIRMED_BODY,
    'already-parked': { statusCode: CONFLICT, error: 'ALREADY_PARKED', message: 'This session is already parked.' },
    closed: SESSION_CLOSED_BODY,
    'spot-not-assigned': { statusCode: CONFLICT, error: 'SPOT_NOT_ASSIGNED', message: 'This spot is not the one assigned to this session.' },
    'lot-busy': LOT_BUSY_BODY,
  },
  'spot-taken report',
);

export function registerSpotTakenRoute(server: FastifyInstance, driverAccess: DriverAccess, reports: SpotTakenReportRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: spotTakenRequestSchema, response: { 200: spotTakenResponseSchema } };
  server.post<SpotTakenRoute>('/v1/entries/:sessionId/spot-taken', { onRequest, schema }, (request, reply) => report(reports, request, reply));
}

async function report(reports: SpotTakenReportRepository, request: FastifyRequest<SpotTakenRoute>, reply: FastifyReply): Promise<SpotTakenResponse | FastifyReply> {
  const spotNumber = request.body.spotNumber.trim();
  if (isBlankSpotNumber(spotNumber)) {
    return replyBlankSpotNumber(reply);
  }
  const reported = await reports.report({ sessionId: request.params.sessionId, driverId: signedInDriver(request).id, spotNumber });
  if (reported.outcome === 'reassigned' || reported.outcome === 'none-free') {
    return reported;
  }
  return sendRefusal(reported.outcome, request, reply);
}

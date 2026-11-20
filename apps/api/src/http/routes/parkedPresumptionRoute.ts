import type { ParkedPresumptionRefusalCode, ParkedPresumptionRequest, ParkedPresumptionResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ParkedPresumption, ParkedPresumptionRepository, WalkingSignal } from '../../domain/parkingSessions/ParkedPresumption.ts';
import { isStorableDate } from '../../domain/time/storableDate.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { ENTRY_NOT_CONFIRMED_BODY, LOT_BUSY_BODY, refusalSender, SESSION_CLOSED_BODY, TOO_MANY_PARKED_SIGNALS_BODY } from '../parkedRefusals.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';
import { PARKED_ATTEMPT_WINDOW_MILLISECONDS, PARKED_SIGNAL_LIMIT } from '../../domain/parkingSessions/parkedAttemptLimits.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { parkedPresumptionRequestSchema, parkedPresumptionResponseSchema } from '../schemas/parkingSessionSchemas.ts';

const BAD_REQUEST = 400;
interface ParkedRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: ParkedPresumptionRequest;
}

const sendRefusal = refusalSender<Exclude<ParkedPresumption['outcome'], 'recorded' | 'already'>, ParkedPresumptionRefusalCode>(
  {
    'not-found': SESSION_NOT_FOUND_BODY,
    'entry-not-confirmed': ENTRY_NOT_CONFIRMED_BODY,
    closed: SESSION_CLOSED_BODY,
    'lot-busy': LOT_BUSY_BODY,
  },
  'walking signal',
);

export function registerParkedPresumptionRoute(server: FastifyInstance, driverAccess: DriverAccess, presumptions: ParkedPresumptionRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: parkedPresumptionRequestSchema, response: { 200: parkedPresumptionResponseSchema } };
  const limiter = createSetupLimiter(PARKED_SIGNAL_LIMIT, PARKED_ATTEMPT_WINDOW_MILLISECONDS);
  server.post<ParkedRoute>('/v1/entries/:sessionId/parked', { onRequest, schema }, (request, reply) => presume({ presumptions, limiter }, request, reply));
}

interface PresumeContext {
  readonly presumptions: ParkedPresumptionRepository;
  readonly limiter: SetupLimiter;
}

async function presume(
  { presumptions, limiter }: PresumeContext,
  request: FastifyRequest<ParkedRoute>,
  reply: FastifyReply,
): Promise<ParkedPresumptionResponse | FastifyReply> {
  if (!limiter.allow(signedInDriver(request).id)) {
    return reply.status(TOO_MANY_PARKED_SIGNALS_BODY.statusCode).send(TOO_MANY_PARKED_SIGNALS_BODY);
  }
  const detectedAt = new Date(request.body.detectedAt);
  // The schema's date-time format admits a leap second, which Date cannot hold, and year 0000, which Postgres cannot.
  if (!isStorableDate(detectedAt)) {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'detectedAt is not a valid date.' });
  }
  const presumption = await presumptions.presume(walkingSignalOf(request, detectedAt));
  if (presumption.outcome === 'recorded' || presumption.outcome === 'already') {
    return { state: presumption.state, parkedAt: presumption.parkedAt.toISOString() };
  }
  return sendRefusal(presumption.outcome, request, reply);
}

function walkingSignalOf(request: FastifyRequest<ParkedRoute>, detectedAt: Date): WalkingSignal {
  const { sessionId } = request.params;
  return { sessionId, driverId: signedInDriver(request).id, detectedAt, detectedAisleMinor: request.body.detectedAisleMinor ?? null };
}

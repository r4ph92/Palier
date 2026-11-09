import type { ExitRefusalCode, ExitResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { exitParking, type ExitDependencies, type ExitRefusal } from '../../domain/exits/exitParking.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { ENTRY_NOT_CONFIRMED_BODY, LOT_BUSY_BODY, refusalSender, SESSION_CLOSED_BODY } from '../parkedRefusals.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { exitResponseSchema } from '../schemas/parkingSessionSchemas.ts';

const SERVICE_UNAVAILABLE = 503;

export interface ExitRouteDependencies {
  readonly exit: ExitDependencies;
  // Read once per tap, so the price and the exit time are one instant.
  readonly clock: Clock;
}

interface ExitRoute {
  readonly Params: EntrySessionParameters;
}

const PAYMENTS_UNAVAILABLE_BODY = { statusCode: SERVICE_UNAVAILABLE, error: 'PAYMENTS_UNAVAILABLE', message: 'The payment could not be taken; try again.' } as const;

const sendRefusal = refusalSender<ExitRefusal, ExitRefusalCode>(
  {
    'not-found': SESSION_NOT_FOUND_BODY,
    'entry-not-confirmed': ENTRY_NOT_CONFIRMED_BODY,
    closed: SESSION_CLOSED_BODY,
    'gate-unavailable': { statusCode: SERVICE_UNAVAILABLE, error: 'GATE_UNAVAILABLE', message: 'This parking lot has no exit gate to open.' },
    'payments-unavailable': PAYMENTS_UNAVAILABLE_BODY,
    'lot-busy': LOT_BUSY_BODY,
  },
  'exit',
);

// The tap on "Ouvrir la barrière de sortie": takes the amount, closes the session, orders the barrier open (docs/03, sequence C).
// Without the exit dependencies (a server composed without payments) every tap answers PAYMENTS_UNAVAILABLE.
export function registerExitRoute(server: FastifyInstance, driverAccess: DriverAccess, exit: ExitRouteDependencies | undefined): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, response: { 200: exitResponseSchema } };
  server.post<ExitRoute>('/v1/entries/:sessionId/exit', { onRequest, schema }, (request, reply) => leave(exit, request, reply));
}

async function leave(exit: ExitRouteDependencies | undefined, request: FastifyRequest<ExitRoute>, reply: FastifyReply): Promise<ExitResponse | FastifyReply> {
  if (exit === undefined) {
    return reply.status(SERVICE_UNAVAILABLE).send(PAYMENTS_UNAVAILABLE_BODY);
  }
  const left = await exitParking(exit.exit, { sessionId: request.params.sessionId, driverId: signedInDriver(request).id, now: exit.clock() });
  if (left.outcome === 'left' || left.outcome === 'already') {
    return { receipt: left.receipt };
  }
  return sendRefusal(left.outcome, request, reply);
}

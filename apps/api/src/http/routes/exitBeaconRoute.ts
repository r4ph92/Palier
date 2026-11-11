import type { ExitBeaconRefusalCode, ExitBeaconRequest } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { reportExitBeacon, type BeaconReportOutcome, type BeaconReportRefusal } from '../../domain/exits/identifyByBeacon.ts';
import type { ExitRouteDependencies } from './exitRoute.ts';
import { ENTRY_NOT_CONFIRMED_BODY, LOT_BUSY_BODY, refusalSender, SESSION_CLOSED_BODY } from '../parkedRefusals.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { exitBeaconRequestSchema } from '../schemas/parkingSessionSchemas.ts';

const NO_CONTENT = 204;
const CONFLICT = 409;
const SERVICE_UNAVAILABLE = 503;

interface ExitBeaconRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: ExitBeaconRequest;
}

const sendRefusal = refusalSender<BeaconReportRefusal | 'lot-busy', ExitBeaconRefusalCode>(
  {
    'not-found': SESSION_NOT_FOUND_BODY,
    'entry-not-confirmed': ENTRY_NOT_CONFIRMED_BODY,
    closed: SESSION_CLOSED_BODY,
    'wrong-lot': { statusCode: CONFLICT, error: 'BEACON_NOT_THIS_LOT', message: 'This beacon is not the one of this session\'s parking lot.' },
    'lot-busy': LOT_BUSY_BODY,
  },
  'exit beacon report',
);

// The app saw the exit beacon. The answer says only that the report was taken: the exit itself happens when the vehicle is at the gate,
// and the app learns of it by reading its session (decision 029). A server composed without payments takes no report.
export function registerExitBeaconRoute(server: FastifyInstance, driverAccess: DriverAccess, exit: ExitRouteDependencies | undefined): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { params: entrySessionParametersSchema, body: exitBeaconRequestSchema };
  server.post<ExitBeaconRoute>('/v1/entries/:sessionId/exit-beacon', { onRequest, schema }, (request, reply) => report(exit, request, reply));
}

async function report(exit: ExitRouteDependencies | undefined, request: FastifyRequest<ExitBeaconRoute>, reply: FastifyReply): Promise<FastifyReply> {
  if (exit === undefined) {
    return reply.status(SERVICE_UNAVAILABLE).send({ statusCode: SERVICE_UNAVAILABLE, error: 'PAYMENTS_UNAVAILABLE', message: 'The payment could not be taken; try again.' });
  }
  const reported = await reportExitBeacon(exit.exit, {
    sessionId: request.params.sessionId,
    driverId: signedInDriver(request).id,
    major: request.body.major,
    now: exit.clock(),
  });
  return isRefusal(reported) ? sendRefusal(reported.outcome, request, reply) : accepted(reported, request, reply);
}

function isRefusal(reported: BeaconReportOutcome): reported is { readonly outcome: BeaconReportRefusal } {
  return reported.outcome === 'not-found' || reported.outcome === 'entry-not-confirmed' || reported.outcome === 'closed' || reported.outcome === 'wrong-lot';
}

// A card or a gate that could not follow is for the logs: the driver still has the tap.
function accepted(reported: BeaconReportOutcome, request: FastifyRequest<ExitBeaconRoute>, reply: FastifyReply): FastifyReply {
  if (reported.outcome === 'lot-busy' || reported.outcome === 'payments-unavailable' || reported.outcome === 'gate-unavailable') {
    request.log.warn({ sessionId: request.params.sessionId, reason: reported.outcome }, 'exit by beacon could not complete; the driver uses the tap');
  }
  return reply.status(NO_CONTENT).send();
}

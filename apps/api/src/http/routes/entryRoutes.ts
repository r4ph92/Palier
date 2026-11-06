import type { EntryRequest } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { EntryAdmission } from '../../domain/entries/EntryAdmission.ts';
import type { ParkingSessionRepository } from '../../domain/entries/ParkingSessionRepository.ts';
import type { EntryEligibility } from '../../domain/entries/EntryEligibility.ts';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { handleEntryError } from '../entries/handleEntryError.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS } from '../../domain/entries/entryLimit.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { registerEntryStatusRoute } from './entryStatusRoute.ts';
import { entryRequestSchema, entryResponseSchema } from '../schemas/entrySchemas.ts';

const CREATED = 201;

export interface EntryRouteDependencies {
  readonly eligibility: EntryEligibility;
  readonly admission: EntryAdmission;
  readonly sessions: ParkingSessionRepository;
  // Read once per entry request, so the eligibility and the hold use see one instant.
  readonly clock: Clock;
}

interface EnterRoute {
  readonly Body: EntryRequest;
}

// Refusals get their own error handler in this scope, so the server-wide handler never sees them.
export function registerEntryRoutes(server: FastifyInstance, driverAccess: DriverAccess, entries: EntryRouteDependencies | undefined): void {
  const guards = consentedDriverGuards(driverAccess);
  const limiter = createSetupLimiter(ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS);
  registerEntryStatusRoute(server, driverAccess, entries?.sessions);
  void server.register(async (scope) => {
    scope.setErrorHandler(handleEntryError);
    scope.post<EnterRoute>(
      '/v1/entries',
      { onRequest: guards, schema: { body: entryRequestSchema, response: { [CREATED]: entryResponseSchema } } },
      (request, reply) => enter(request, reply, { entries, limiter }),
    );
  });
}

interface EnterContext {
  readonly entries: EntryRouteDependencies | undefined;
  readonly limiter: SetupLimiter;
}

// Only an entry that passed every check counts against the limit: a wrong QR never reaches Stripe.
async function enter(request: FastifyRequest<EnterRoute>, reply: FastifyReply, { entries, limiter }: EnterContext) {
  if (entries === undefined) {
    throw new EntryRefusedError('PAYMENTS_UNAVAILABLE');
  }
  const driver = signedInDriver(request);
  const eligible = await entries.eligibility.check({ driverId: driver.id, qrContent: request.body.qrContent, now: entries.clock() });
  if (!limiter.allow(driver.id)) {
    throw new EntryRefusedError('TOO_MANY_ENTRIES');
  }
  const admitted = await entries.admission.admit(eligible, request.log);
  if (admitted.kind === 'replayed') {
    limiter.refund(driver.id);
  }
  return reply.status(CREATED).send(admitted.response);
}

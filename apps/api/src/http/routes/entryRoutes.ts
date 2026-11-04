import type { EntryRequest, EntryResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import type { EntryAdmission } from '../../domain/entries/EntryAdmission.ts';
import type { EntryEligibility } from '../../domain/entries/EntryEligibility.ts';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { handleEntryError } from '../entries/handleEntryError.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';
import { requireConsent } from '../requireConsent.ts';
import { requireDriver, signedInDriver } from '../requireDriver.ts';
import { entryRequestSchema, entryResponseSchema } from '../schemas/entrySchemas.ts';

const CREATED = 201;
const TOO_MANY_REQUESTS = 429;
// Same window as card setups: it bounds the card holds one driver token can ask Stripe for.
const ENTRY_LIMIT = 5;
const ENTRY_WINDOW_MILLISECONDS = 10 * 60 * 1000;

export interface EntryRouteDependencies {
  readonly eligibility: EntryEligibility;
  readonly admission: EntryAdmission;
}

interface EnterRoute {
  readonly Body: EntryRequest;
}

// Refusals get their own error handler in this scope, so the server-wide handler never sees them.
export function registerEntryRoutes(server: FastifyInstance, driverRepository: DriverRepository, entries: EntryRouteDependencies | undefined): void {
  const guards = [requireDriver(driverRepository), requireConsent(driverRepository)];
  const limiter = createSetupLimiter(ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS);
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
  const eligible = await entries.eligibility.check({ driverId: driver.id, qrContent: request.body.qrContent });
  if (!limiter.allow(driver.id)) {
    return reply.status(TOO_MANY_REQUESTS).send({
      statusCode: TOO_MANY_REQUESTS,
      error: 'TOO_MANY_ENTRIES',
      message: 'Too many entry attempts. Try again in a few minutes.',
    });
  }
  const admitted: EntryResponse = await entries.admission.admit(eligible, request.log);
  return reply.status(CREATED).send(admitted);
}

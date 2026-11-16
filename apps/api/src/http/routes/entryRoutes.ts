import type { EntryQuoteRequest, EntryQuoteResponse, EntryRequest } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { EntryAdmission } from '../../domain/entries/EntryAdmission.ts';
import type { ParkingSessionRepository } from '../../domain/entries/ParkingSessionRepository.ts';
import type { EntryEligibility } from '../../domain/entries/EntryEligibility.ts';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { requireAcceptedTariff } from '../../domain/entries/acceptedTariff.ts';
import { handleEntryError } from '../entries/handleEntryError.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS } from '../../domain/entries/entryLimit.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { registerEntryStatusRoute } from './entryStatusRoute.ts';
import { entryQuoteRequestSchema, entryQuoteResponseSchema, entryRequestSchema, entryResponseSchema } from '../schemas/entrySchemas.ts';
import type { EligibleEntry } from '../../domain/entries/EntryEligibility.ts';

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

interface QuoteRoute {
  readonly Body: EntryQuoteRequest;
}

// Refusals get their own error handler in this scope, so the server-wide handler never sees them.
export function registerEntryRoutes(server: FastifyInstance, driverAccess: DriverAccess, entries: EntryRouteDependencies | undefined): void {
  const guards = consentedDriverGuards(driverAccess);
  const limiter = createSetupLimiter(ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS);
  const quoteLimiter = createSetupLimiter(ENTRY_LIMIT, ENTRY_WINDOW_MILLISECONDS);
  registerEntryStatusRoute(server, driverAccess, entries?.sessions);
  void server.register(async (scope) => {
    scope.setErrorHandler(handleEntryError);
    scope.post<QuoteRoute>(
      '/v1/entries/quote',
      { onRequest: guards, schema: { body: entryQuoteRequestSchema, response: { 200: entryQuoteResponseSchema } } },
      (request) => quote(request, { entries, limiter: quoteLimiter }),
    );
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

// The entry's own checks, read only: the driver sees the lot's tariff and the hold, and nothing is held, assigned or opened (#151).
// Like an entry, only a quote that passed every check counts against its limit.
async function quote(request: FastifyRequest<QuoteRoute>, { entries, limiter }: EnterContext): Promise<EntryQuoteResponse> {
  if (entries === undefined) {
    throw new EntryRefusedError('PAYMENTS_UNAVAILABLE');
  }
  const driver = signedInDriver(request);
  const eligible = await entries.eligibility.check({ driverId: driver.id, qrContent: request.body.qrContent, now: entries.clock() });
  if (!limiter.allow(driver.id)) {
    throw new EntryRefusedError('TOO_MANY_ENTRIES');
  }
  return quoteOf(eligible);
}

function quoteOf({ gate, pricing, payment }: EligibleEntry): EntryQuoteResponse {
  return {
    lotName: gate.lotName,
    tariff: { incrementCents: pricing.incrementCents, incrementMinutes: pricing.incrementMinutes, dailyCapCents: pricing.dailyCapCents },
    holdCents: payment.amountCents,
  };
}

// Only an entry that passed every check counts against the limit: a wrong QR never reaches Stripe.
async function enter(request: FastifyRequest<EnterRoute>, reply: FastifyReply, { entries, limiter }: EnterContext) {
  if (entries === undefined) {
    throw new EntryRefusedError('PAYMENTS_UNAVAILABLE');
  }
  const driver = signedInDriver(request);
  const eligible = await entries.eligibility.check({ driverId: driver.id, qrContent: request.body.qrContent, now: entries.clock() });
  requireAcceptedTariff(request.body.tariff, eligible.pricing);
  if (!limiter.allow(driver.id)) {
    throw new EntryRefusedError('TOO_MANY_ENTRIES');
  }
  const admitted = await entries.admission.admit(eligible, request.log);
  if (admitted.kind === 'replayed') {
    limiter.refund(driver.id);
  }
  return reply.status(CREATED).send(admitted.response);
}

import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricingRequest } from '@palier/shared-types/lotPricing';
import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { createLotOfMember, findLotDetailsOfMember, setLotPricingOfMember, type LotSetupSources } from '../../domain/dashboard/lotSetup.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { dashboardLotDetailsSchema, lotDraftBodySchema, lotPricingBodySchema } from '../schemas/lotSetupSchemas.ts';
import { DashboardHttpRefusal } from './DashboardHttpRefusal.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

const CREATED = 201;
// Each lot takes a beacon major for good from one platform-wide sequence of 65 535, so one member may create ten lots an hour.
const LOT_CREATION_LIMIT = 10;
const LOT_CREATION_WINDOW_SECONDS = 60 * 60;

interface LotRoute {
  readonly Params: { readonly id: string };
}

interface PricingRoute extends LotRoute {
  readonly Body: LotPricingRequest;
}

interface LotCreation {
  readonly sources: LotSetupSources;
  readonly limiter: SetupLimiter;
}

interface LotRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotSetupSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardLotRoutes(scope: FastifyInstance, { access, operators, lots }: DashboardRouteDependencies): void {
  const context: LotRoutesContext = { scope, sources: { operators, lots }, onRequest: requireDashboardUser(access.sessions) };
  registerCreateLotRoute(context, createSetupLimiter(LOT_CREATION_LIMIT, LOT_CREATION_WINDOW_SECONDS * 1000));
  registerLotDetailsRoute(context);
  registerLotPricingRoute(context);
}

function registerCreateLotRoute({ scope, sources, onRequest }: LotRoutesContext, limiter: SetupLimiter): void {
  const schema = { body: lotDraftBodySchema, response: { [CREATED]: dashboardLotDetailsSchema } };
  scope.post<{ readonly Body: LotDraft }>('/v1/dashboard/lots', { onRequest, schema }, async (request, reply) => {
    const userId = signedInDashboardUser(request).id;
    if (!limiter.allow(userId)) {
      // Retry-After is the whole window, which is always enough to clear it.
      reply.header('Retry-After', LOT_CREATION_WINDOW_SECONDS);
      throw new DashboardHttpRefusal('TOO_MANY_LOTS');
    }
    return reply.status(CREATED).send(await createLotRefundingRefusals({ sources, limiter }, userId, request.body));
  });
}

// A refused creation took no beacon major, so it must not eat the member's hourly allowance.
async function createLotRefundingRefusals({ sources, limiter }: LotCreation, userId: string, draft: LotDraft): Promise<DashboardLotDetails> {
  try {
    return await createLotOfMember(sources, userId, draft);
  } catch (error) {
    if (error instanceof DashboardRefusedError) {
      limiter.refund(userId);
    }
    throw error;
  }
}

// A malformed id gets the same 404 as another operator's lot, so the answer never tells the two apart.
function registerLotDetailsRoute({ scope, sources, onRequest }: LotRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardLotDetailsSchema } };
  scope.get<LotRoute>('/v1/dashboard/lots/:id', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotDetails> => {
    refuseMalformedLotId(request);
    return findLotDetailsOfMember(sources, signedInDashboardUser(request).id, request.params.id);
  });
}

// A malformed id answers 404 like the read; a malformed body is the caller's mistake and answers 400.
function registerLotPricingRoute({ scope, sources, onRequest }: LotRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: lotPricingBodySchema, response: { 200: dashboardLotDetailsSchema } };
  scope.put<PricingRoute>('/v1/dashboard/lots/:id/pricing', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotDetails> => {
    refuseMalformedLotId(request);
    if (request.validationError !== undefined) {
      throw request.validationError;
    }
    const change = { userId: signedInDashboardUser(request).id, lotId: request.params.id, pricing: request.body };
    return setLotPricingOfMember(sources, change);
  });
}

function refuseMalformedLotId(request: FastifyRequest): void {
  if (request.validationError?.validationContext === 'params') {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
}

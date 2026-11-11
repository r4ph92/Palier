import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricingRequest } from '@palier/shared-types/lotPricing';
import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { createLotOfMember, findLotDetailsOfMember, setLotPricingOfMember, type LotSetupSources } from '../../domain/dashboard/lotSetup.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { dashboardLotDetailsSchema, lotDraftBodySchema, lotPricingBodySchema } from '../schemas/lotSetupSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

const CREATED = 201;

interface LotRoute {
  readonly Params: { readonly id: string };
}

interface PricingRoute extends LotRoute {
  readonly Body: LotPricingRequest;
}

interface LotRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotSetupSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardLotRoutes(scope: FastifyInstance, { access, operators, lots }: DashboardRouteDependencies): void {
  const context: LotRoutesContext = { scope, sources: { operators, lots }, onRequest: requireDashboardUser(access.sessions) };
  registerCreateLotRoute(context);
  registerLotDetailsRoute(context);
  registerLotPricingRoute(context);
}

function registerCreateLotRoute({ scope, sources, onRequest }: LotRoutesContext): void {
  const schema = { body: lotDraftBodySchema, response: { [CREATED]: dashboardLotDetailsSchema } };
  scope.post<{ readonly Body: LotDraft }>('/v1/dashboard/lots', { onRequest, schema }, async (request, reply) => {
    return reply.status(CREATED).send(await createLotOfMember(sources, signedInDashboardUser(request).id, request.body));
  });
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

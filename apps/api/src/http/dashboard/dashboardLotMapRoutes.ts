import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import type { AisleRequest } from '@palier/shared-types/aisleDraft';
import type { LevelDraft } from '@palier/shared-types/levelDraft';
import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { addAisleOfMember, addLevelOfMember, readLotMapOfMember, reorderLevelsOfMember, type LotMapSources, type MemberLot } from '../../domain/dashboard/lotMap.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { aisleBodySchema, dashboardLotMapSchema, levelDraftBodySchema, levelOrderBodySchema, lotLevelParametersSchema } from '../schemas/lotMapSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { refuseMalformedLotId } from './refuseMalformedLotId.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

interface LotParams {
  readonly id: string;
}

interface LevelParams extends LotParams {
  readonly levelId: string;
}

interface MapRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotMapSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

const response = { 200: dashboardLotMapSchema };

export function registerDashboardLotMapRoutes(scope: FastifyInstance, { access, operators, maps }: DashboardRouteDependencies): void {
  const context: MapRoutesContext = { scope, sources: { operators, maps }, onRequest: requireDashboardUser(access.sessions) };
  registerReadMapRoute(context);
  registerAddLevelRoute(context);
  registerReorderLevelsRoute(context);
  registerAddAisleRoute(context);
}

function registerReadMapRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/map', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedLotId(request);
    return readLotMapOfMember(sources, memberLotOf(request));
  });
}

function registerAddLevelRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: levelDraftBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels';
  scope.post<{ readonly Params: LotParams; readonly Body: LevelDraft }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return addLevelOfMember(sources, memberLotOf(request), request.body);
  });
}

function registerReorderLevelsRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: levelOrderBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels/order';
  scope.put<{ readonly Params: LotParams; readonly Body: LevelOrderRequest }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return reorderLevelsOfMember(sources, memberLotOf(request), request.body);
  });
}

// A malformed level id answers the lot's 404 too: the answer never tells which of the two ids was wrong.
function registerAddAisleRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotLevelParametersSchema, body: aisleBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels/:levelId/aisles';
  scope.post<{ readonly Params: LevelParams; readonly Body: AisleRequest }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return addAisleOfMember(sources, { ...memberLotOf(request), levelId: request.params.levelId }, request.body);
  });
}

// A malformed id answers 404 like the read; a malformed body is the caller's mistake and answers 400.
function refuseMalformedRequest(request: FastifyRequest): void {
  refuseMalformedLotId(request);
  if (request.validationError !== undefined) {
    throw request.validationError;
  }
}

function memberLotOf(request: FastifyRequest<{ readonly Params: LotParams }>): MemberLot {
  return { userId: signedInDashboardUser(request).id, lotId: request.params.id };
}

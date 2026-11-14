import type { DashboardAisleSpots } from '@palier/shared-types';
import type { AddSpotsRequest, SpotAttributes } from '@palier/shared-types/spotDraft';
import type { FastifyInstance, FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { addSpotsOfMember, changeSpotOfMember, readAisleSpotsOfMember, removeSpotOfMember, type LotSpotSources, type MemberAisle, type MemberSpot } from '../../domain/dashboard/lotSpots.ts';
import { addSpotsBodySchema, dashboardAisleSpotsSchema, lotAisleParametersSchema, lotSpotParametersSchema, spotAttributesBodySchema } from '../schemas/lotSpotSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface AisleParams extends LotParams {
  readonly aisleId: string;
}

interface SpotParams extends LotParams {
  readonly spotId: string;
}

interface SpotRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotSpotSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

const CREATED = 201;
const AISLE_SPOTS_ROUTE = '/v1/dashboard/lots/:id/aisles/:aisleId/spots';
const SPOT_ROUTE = '/v1/dashboard/lots/:id/spots/:spotId';

export function registerDashboardLotSpotRoutes(scope: FastifyInstance, { access, operators, spots }: DashboardRouteDependencies): void {
  const context: SpotRoutesContext = { scope, sources: { operators, spots }, onRequest: requireDashboardUser(access.sessions) };
  registerReadSpotsRoute(context);
  registerAddSpotsRoute(context);
  registerChangeSpotRoute(context);
  registerRemoveSpotRoute(context);
}

// A malformed aisle or spot id answers the lot's 404 too: the answer never tells which id was wrong.
function registerReadSpotsRoute({ scope, sources, onRequest }: SpotRoutesContext): void {
  const schema = { params: lotAisleParametersSchema, response: { 200: dashboardAisleSpotsSchema } };
  scope.get<{ readonly Params: AisleParams }>(AISLE_SPOTS_ROUTE, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardAisleSpots> => {
    refuseMalformedRequest(request);
    return readAisleSpotsOfMember(sources, memberAisleOf(request));
  });
}

function registerAddSpotsRoute({ scope, sources, onRequest }: SpotRoutesContext): void {
  const schema = { params: lotAisleParametersSchema, body: addSpotsBodySchema, response: { [CREATED]: dashboardAisleSpotsSchema } };
  type AddSpots = { readonly Params: AisleParams; readonly Body: AddSpotsRequest };
  scope.post<AddSpots>(AISLE_SPOTS_ROUTE, { onRequest, attachValidation: true, schema }, async (request: FastifyRequest<AddSpots>, reply: FastifyReply) => {
    refuseMalformedRequest(request);
    return reply.status(CREATED).send(await addSpotsOfMember(sources, memberAisleOf(request), request.body));
  });
}

function registerChangeSpotRoute({ scope, sources, onRequest }: SpotRoutesContext): void {
  const schema = { params: lotSpotParametersSchema, body: spotAttributesBodySchema, response: { 200: dashboardAisleSpotsSchema } };
  scope.put<{ readonly Params: SpotParams; readonly Body: SpotAttributes }>(SPOT_ROUTE, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardAisleSpots> => {
    refuseMalformedRequest(request);
    return changeSpotOfMember(sources, memberSpotOf(request), request.body);
  });
}

function registerRemoveSpotRoute({ scope, sources, onRequest }: SpotRoutesContext): void {
  const schema = { params: lotSpotParametersSchema, response: { 200: dashboardAisleSpotsSchema } };
  scope.delete<{ readonly Params: SpotParams }>(SPOT_ROUTE, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardAisleSpots> => {
    refuseMalformedRequest(request);
    return removeSpotOfMember(sources, memberSpotOf(request));
  });
}

function memberAisleOf(request: FastifyRequest<{ readonly Params: AisleParams }>): MemberAisle {
  return { ...memberLotOf(request), aisleId: request.params.aisleId };
}

function memberSpotOf(request: FastifyRequest<{ readonly Params: SpotParams }>): MemberSpot {
  return { ...memberLotOf(request), spotId: request.params.spotId };
}

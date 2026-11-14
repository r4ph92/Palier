import type { DashboardSpotsToCheck } from '@palier/shared-types';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { clearSpotCheckOfMember, readSpotsToCheckOfMember, type SpotCheckSources } from '../../domain/dashboard/spotsToCheck.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { lotSpotParametersSchema } from '../schemas/lotSpotSchemas.ts';
import { spotsToCheckSchema } from '../schemas/spotCheckSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, memberSpotOf, refuseMalformedRequest, SPOT_ROUTE, type LotParams, type SpotParams } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface SpotCheckRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: SpotCheckSources;
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardSpotCheckRoutes(scope: FastifyInstance, { access, operators, spotChecks }: DashboardRouteDependencies): void {
  const context: SpotCheckRoutesContext = { scope, sources: { operators, spotChecks }, onRequest: requireDashboardUser(access.sessions) };
  registerReadSpotsToCheckRoute(context);
  registerClearSpotCheckRoute(context);
}

function registerReadSpotsToCheckRoute({ scope, sources, onRequest }: SpotCheckRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: spotsToCheckSchema } };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/spots-to-check', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardSpotsToCheck> => {
    refuseMalformedRequest(request);
    return readSpotsToCheckOfMember(sources, memberLotOf(request));
  });
}

// A malformed spot id answers the lot's 404 too: the answer never tells which id was wrong.
function registerClearSpotCheckRoute({ scope, sources, onRequest }: SpotCheckRoutesContext): void {
  const schema = { params: lotSpotParametersSchema, response: { 200: spotsToCheckSchema } };
  scope.post<{ readonly Params: SpotParams }>(`${SPOT_ROUTE}/check-cleared`, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardSpotsToCheck> => {
    refuseMalformedRequest(request);
    return clearSpotCheckOfMember(sources, memberSpotOf(request));
  });
}

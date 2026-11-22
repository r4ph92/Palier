import type { DashboardStaleSessions } from '@palier/shared-types';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { closeAtLastProofOfMember, confirmPresenceOfMember, listStaleSessionsOfMember, type StaleSessionSources } from '../../domain/dashboard/staleSessions.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { staleSessionParametersSchema, staleSessionsSchema } from '../schemas/staleSessionSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { refuseMalformedSessionRequest } from './refuseMalformedSessionRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface StaleSessionParams extends LotParams {
  readonly sessionId: string;
}

interface StaleSessionRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: StaleSessionSources;
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardStaleSessionRoutes(scope: FastifyInstance, { access, operators, staleSessionReviews, clock, holds }: DashboardRouteDependencies): void {
  const context: StaleSessionRoutesContext = {
    scope,
    sources: { operators, staleSessions: staleSessionReviews, clock, holds },
    onRequest: requireDashboardUser(access.sessions),
  };
  registerListStaleSessionsRoute(context);
  registerConfirmPresenceRoute(context);
  registerCloseAtLastProofRoute(context);
}

function registerListStaleSessionsRoute({ scope, sources, onRequest }: StaleSessionRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: staleSessionsSchema } };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/stale-sessions', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardStaleSessions> => {
    refuseMalformedRequest(request);
    return listStaleSessionsOfMember(sources, memberLotOf(request));
  });
}

// A malformed session id answers the session's 404 and a malformed lot id the lot's, each like an id that matches nothing.
function registerConfirmPresenceRoute({ scope, sources, onRequest }: StaleSessionRoutesContext): void {
  const schema = { params: staleSessionParametersSchema, response: { 200: staleSessionsSchema } };
  scope.post<{ readonly Params: StaleSessionParams }>('/v1/dashboard/lots/:id/stale-sessions/:sessionId/presence', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardStaleSessions> => {
    refuseMalformedSessionRequest(request);
    return confirmPresenceOfMember(sources, { ...memberLotOf(request), sessionId: request.params.sessionId });
  });
}

// Same refusals as the presence check; the answer is the list that remains once the session left it.
function registerCloseAtLastProofRoute({ scope, sources, onRequest }: StaleSessionRoutesContext): void {
  const schema = { params: staleSessionParametersSchema, response: { 200: staleSessionsSchema } };
  scope.post<{ readonly Params: StaleSessionParams }>('/v1/dashboard/lots/:id/stale-sessions/:sessionId/close', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardStaleSessions> => {
    refuseMalformedSessionRequest(request);
    return closeAtLastProofOfMember(sources, { ...memberLotOf(request), sessionId: request.params.sessionId }, request.log);
  });
}

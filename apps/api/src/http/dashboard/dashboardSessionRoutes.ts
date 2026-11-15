import type { DashboardSessionDetail, DashboardSessionList } from '@palier/shared-types';
import type { SessionListStatus } from '@palier/shared-types/sessionTimeline';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { listSessionsOfMember, readSessionOfMember, type SessionTimelineSources } from '../../domain/dashboard/sessionTimelines.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { sessionDetailSchema, sessionListQuerySchema, sessionListSchema, sessionParametersSchema } from '../schemas/sessionTimelineSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { refuseMalformedSessionRequest } from './refuseMalformedSessionRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface SessionParams extends LotParams {
  readonly sessionId: string;
}

interface SessionListQuery {
  readonly status?: SessionListStatus;
  readonly before?: string;
}

interface SessionRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: SessionTimelineSources;
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardSessionRoutes(scope: FastifyInstance, { access, operators, sessionTimelines }: DashboardRouteDependencies): void {
  const context: SessionRoutesContext = { scope, sources: { operators, sessions: sessionTimelines }, onRequest: requireDashboardUser(access.sessions) };
  registerListSessionsRoute(context);
  registerReadSessionRoute(context);
}

function registerListSessionsRoute({ scope, sources, onRequest }: SessionRoutesContext): void {
  const schema = { params: lotIdParametersSchema, querystring: sessionListQuerySchema, response: { 200: sessionListSchema } };
  scope.get<{ readonly Params: LotParams; readonly Querystring: SessionListQuery }>('/v1/dashboard/lots/:id/sessions', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardSessionList> => {
    refuseMalformedRequest(request);
    const { status = 'OPEN', before = null } = request.query;
    return listSessionsOfMember(sources, memberLotOf(request), { status, before });
  });
}

function registerReadSessionRoute({ scope, sources, onRequest }: SessionRoutesContext): void {
  const schema = { params: sessionParametersSchema, response: { 200: sessionDetailSchema } };
  scope.get<{ readonly Params: SessionParams }>('/v1/dashboard/lots/:id/sessions/:sessionId', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardSessionDetail> => {
    refuseMalformedSessionRequest(request);
    return readSessionOfMember(sources, { ...memberLotOf(request), sessionId: request.params.sessionId });
  });
}

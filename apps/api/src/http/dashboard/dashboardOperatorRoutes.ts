import type { CreateOperatorRequest, DashboardLotListResponse, DashboardMeResponse } from '@palier/shared-types';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import { createOperator, listLotsOfMember } from '../../domain/dashboard/operatorDashboard.ts';
import {
  createOperatorBodySchema,
  dashboardLotListSchema,
  dashboardMeSchema,
  dashboardOperatorSchema,
} from '../schemas/dashboardSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

const CREATED = 201;

interface CreateOperatorRoute {
  readonly Body: CreateOperatorRequest;
}

interface OperatorRoutesContext {
  readonly scope: FastifyInstance;
  readonly operators: OperatorRepository;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardOperatorRoutes(scope: FastifyInstance, { access, operators }: DashboardRouteDependencies): void {
  const context: OperatorRoutesContext = { scope, operators, onRequest: requireDashboardUser(access.sessions) };
  registerMeRoute(context);
  registerCreateOperatorRoute(context);
  registerLotListRoute(context);
}

function registerMeRoute({ scope, operators, onRequest }: OperatorRoutesContext): void {
  scope.get('/v1/dashboard/me', { onRequest, schema: { response: { 200: dashboardMeSchema } } }, async (request): Promise<DashboardMeResponse> => {
    const user = signedInDashboardUser(request);
    return { user, operator: await operators.findOperatorOfMember(user.id) };
  });
}

function registerCreateOperatorRoute({ scope, operators, onRequest }: OperatorRoutesContext): void {
  const schema = { body: createOperatorBodySchema, response: { [CREATED]: dashboardOperatorSchema } };
  scope.post<CreateOperatorRoute>('/v1/dashboard/operators', { onRequest, schema }, async (request, reply) => {
    const userId = signedInDashboardUser(request).id;
    return reply.status(CREATED).send(await createOperator(operators, { userId, legalName: request.body.legalName }));
  });
}

function registerLotListRoute({ scope, operators, onRequest }: OperatorRoutesContext): void {
  scope.get('/v1/dashboard/lots', { onRequest, schema: { response: { 200: dashboardLotListSchema } } }, (request): Promise<DashboardLotListResponse> => {
    return listLotsOfMember(operators, signedInDashboardUser(request).id);
  });
}

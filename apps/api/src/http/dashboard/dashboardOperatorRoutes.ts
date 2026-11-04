import type { CreateOperatorRequest, DashboardLot, DashboardLotListResponse, DashboardMeResponse } from '@palier/shared-types';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import type { OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import { createOperator, findLotOfMember, listLotsOfMember } from '../../domain/dashboard/operatorDashboard.ts';
import {
  createOperatorBodySchema,
  dashboardLotListSchema,
  dashboardLotSchema,
  dashboardMeSchema,
  dashboardOperatorSchema,
  lotIdParametersSchema,
} from '../schemas/dashboardSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

const CREATED = 201;

interface CreateOperatorRoute {
  readonly Body: CreateOperatorRequest;
}

interface LotRoute {
  readonly Params: { readonly id: string };
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
  registerLotRoutes(context);
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

function registerLotRoutes({ scope, operators, onRequest }: OperatorRoutesContext): void {
  scope.get('/v1/dashboard/lots', { onRequest, schema: { response: { 200: dashboardLotListSchema } } }, (request): Promise<DashboardLotListResponse> => {
    return listLotsOfMember(operators, signedInDashboardUser(request).id);
  });
  // A malformed id gets the same 404 as another operator's lot, so the answer never tells the two apart.
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardLotSchema } };
  scope.get<LotRoute>('/v1/dashboard/lots/:id', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLot> => {
    if (request.validationError !== undefined) {
      throw new DashboardRefusedError('LOT_NOT_FOUND');
    }
    return findLotOfMember(operators, signedInDashboardUser(request).id, request.params.id);
  });
}

import type { LotExitShares } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { findLotExitSharesOfMember } from '../../domain/dashboard/findLotExitSharesOfMember.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { lotExitSharesSchema } from '../schemas/exitSharesSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

export function registerDashboardExitRoutes(scope: FastifyInstance, { access, operators, exitIdentifications, clock }: DashboardRouteDependencies): void {
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  const onRequest = requireDashboardUser(access.sessions);
  const schema = { params: lotIdParametersSchema, response: { 200: lotExitSharesSchema } };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/exits', { onRequest, attachValidation: true, schema }, (request): Promise<LotExitShares> => {
    refuseMalformedRequest(request);
    return findLotExitSharesOfMember({ operators, exitIdentifications, clock }, memberLotOf(request));
  });
}

import type { DashboardLotOccupancy } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { findLotOccupancyOfMember } from '../../domain/dashboard/findLotOccupancyOfMember.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { dashboardLotOccupancySchema } from '../schemas/lotOccupancySchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { refuseMalformedLotId } from './refuseMalformedLotId.ts';
import { requireDashboardUser, signedInDashboardUser } from './requireDashboardUser.ts';

interface OccupancyRoute {
  readonly Params: { readonly id: string };
}

export function registerDashboardOccupancyRoutes(scope: FastifyInstance, { access, operators, occupancy, equipment, clock }: DashboardRouteDependencies): void {
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  const onRequest = requireDashboardUser(access.sessions);
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardLotOccupancySchema } };
  scope.get<OccupancyRoute>('/v1/dashboard/lots/:id/occupancy', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotOccupancy> => {
    refuseMalformedLotId(request);
    return findLotOccupancyOfMember({ operators, occupancy, equipment, clock }, { userId: signedInDashboardUser(request).id, lotId: request.params.id });
  });
}

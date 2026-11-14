import type { DashboardLotEquipment } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { readLotEquipmentOfMember } from '../../domain/dashboard/lotEquipment.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { dashboardLotEquipmentSchema } from '../schemas/lotEquipmentSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, type LotParams } from './memberRequest.ts';
import { refuseMalformedLotId } from './refuseMalformedLotId.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

export function registerDashboardEquipmentRoutes(scope: FastifyInstance, { access, operators, equipment, clock }: DashboardRouteDependencies): void {
  // onRequest, not preHandler: params validation runs before preHandler, so a visitor without a session is refused first.
  const onRequest = requireDashboardUser(access.sessions);
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardLotEquipmentSchema } };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/equipment', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotEquipment> => {
    refuseMalformedLotId(request);
    return readLotEquipmentOfMember({ operators, equipment, clock }, memberLotOf(request));
  });
}

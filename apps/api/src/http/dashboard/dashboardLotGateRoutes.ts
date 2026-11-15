import type { DashboardLotGates } from '@palier/shared-types';
import type { GateDraft, GateSettings } from '@palier/shared-types/gateDraft';
import type { FastifyInstance, FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { addGateOfMember, changeGateOfMember, readLotGatesOfMember, type LotGateSources } from '../../domain/dashboard/lotGates.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { createdGateSchema, dashboardLotGatesSchema, gateDraftBodySchema, gateSettingsBodySchema, lotGateParametersSchema } from '../schemas/lotGateSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { keptNowhere, memberGateOf, type GateParams } from './gateRequest.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface GateRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotGateSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

const CREATED = 201;
const LOT_GATES_ROUTE = '/v1/dashboard/lots/:id/gates';
const GATE_ROUTE = '/v1/dashboard/lots/:id/gates/:gateId';

export function registerDashboardLotGateRoutes(scope: FastifyInstance, { access, operators, gates }: DashboardRouteDependencies): void {
  const context: GateRoutesContext = { scope, sources: { operators, gates }, onRequest: requireDashboardUser(access.sessions) };
  registerReadGatesRoute(context);
  registerAddGateRoute(context);
  registerChangeGateRoute(context);
}

function registerReadGatesRoute({ scope, sources, onRequest }: GateRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: dashboardLotGatesSchema } };
  scope.get<{ readonly Params: LotParams }>(LOT_GATES_ROUTE, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotGates> => {
    refuseMalformedRequest(request);
    return readLotGatesOfMember(sources, memberLotOf(request));
  });
}

// The answer holds the new gate's device key, shown once.
function registerAddGateRoute({ scope, sources, onRequest }: GateRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: gateDraftBodySchema, response: { [CREATED]: createdGateSchema } };
  type AddGate = { readonly Params: LotParams; readonly Body: GateDraft };
  scope.post<AddGate>(LOT_GATES_ROUTE, { onRequest, attachValidation: true, schema }, async (request: FastifyRequest<AddGate>, reply: FastifyReply) => {
    refuseMalformedRequest(request);
    return keptNowhere(reply).status(CREATED).send(await addGateOfMember(sources, memberLotOf(request), request.body));
  });
}

// The whole settings each time, checked by the same rule as a new gate; the direction cannot change.
function registerChangeGateRoute({ scope, sources, onRequest }: GateRoutesContext): void {
  const schema = { params: lotGateParametersSchema, body: gateSettingsBodySchema, response: { 200: dashboardLotGatesSchema } };
  scope.put<{ readonly Params: GateParams; readonly Body: GateSettings }>(GATE_ROUTE, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotGates> => {
    refuseMalformedRequest(request);
    return changeGateOfMember(sources, memberGateOf(request), request.body);
  });
}

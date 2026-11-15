import type { FastifyInstance, FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { qrLinkOfMember, replaceDeviceKeyOfMember, replaceQrSecretOfMember, type GateSecretSources } from '../../domain/dashboard/gateSecrets.ts';
import { gateDeviceKeySchema, gateQrLinkSchema, lotGateParametersSchema } from '../schemas/lotGateSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { keptNowhere, memberGateOf, type GateParams } from './gateRequest.ts';
import { refuseMalformedRequest } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface SecretRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: GateSecretSources;
  readonly onRequest: onRequestAsyncHookHandler;
}

type GateRequest = FastifyRequest<{ readonly Params: GateParams }>;

const NO_CONTENT = 204;
const GATE_ROUTE = '/v1/dashboard/lots/:id/gates/:gateId';

// No route ever answers a stored secret: a new device key once, and the QR's signed link.
export function registerDashboardGateSecretRoutes(scope: FastifyInstance, { access, operators, gateSecrets }: DashboardRouteDependencies): void {
  const context: SecretRoutesContext = { scope, sources: { operators, secrets: gateSecrets }, onRequest: requireDashboardUser(access.sessions) };
  registerReplaceDeviceKeyRoute(context);
  registerReplaceQrSecretRoute(context);
  registerQrLinkRoute(context);
}

function registerReplaceDeviceKeyRoute({ scope, sources, onRequest }: SecretRoutesContext): void {
  const schema = { params: lotGateParametersSchema, response: { 200: gateDeviceKeySchema } };
  scope.post<{ readonly Params: GateParams }>(`${GATE_ROUTE}/device-key`, { onRequest, attachValidation: true, schema }, async (request: GateRequest, reply: FastifyReply) => {
    refuseMalformedRequest(request);
    return keptNowhere(reply).send(await replaceDeviceKeyOfMember(sources, memberGateOf(request)));
  });
}

function registerReplaceQrSecretRoute({ scope, sources, onRequest }: SecretRoutesContext): void {
  const schema = { params: lotGateParametersSchema };
  scope.post<{ readonly Params: GateParams }>(`${GATE_ROUTE}/qr-secret`, { onRequest, attachValidation: true, schema }, async (request: GateRequest, reply: FastifyReply) => {
    refuseMalformedRequest(request);
    await replaceQrSecretOfMember(sources, memberGateOf(request));
    return reply.status(NO_CONTENT).send();
  });
}

// A GET the dashboard calls when the operator prints: a gate without a secret yet gets one, and nothing else is written.
function registerQrLinkRoute({ scope, sources, onRequest }: SecretRoutesContext): void {
  const schema = { params: lotGateParametersSchema, response: { 200: gateQrLinkSchema } };
  scope.get<{ readonly Params: GateParams }>(`${GATE_ROUTE}/qr-link`, { onRequest, attachValidation: true, schema }, async (request: GateRequest, reply: FastifyReply) => {
    refuseMalformedRequest(request);
    return keptNowhere(reply).send(await qrLinkOfMember(sources, memberGateOf(request)));
  });
}

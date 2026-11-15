import type { Attestation, AttestationKind, LotOnlineRequest, LotPublication } from '@palier/shared-types';
import { ATTESTATION_KINDS, ATTESTATION_PATH_SEGMENTS } from '@palier/shared-types/publication';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { attestOfMember } from '../../domain/publication/lotAttestations.ts';
import { changeOnlineOfMember, readPublicationOfMember, type LotPublicationSources } from '../../domain/publication/lotPublication.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { attestationBodySchema, lotOnlineBodySchema, lotPublicationSchema } from '../schemas/lotPublicationSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type LotParams } from './memberRequest.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface PublicationRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotPublicationSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

export function registerDashboardLotPublicationRoutes(scope: FastifyInstance, { access, operators, publication, clock }: DashboardRouteDependencies): void {
  const context: PublicationRoutesContext = { scope, sources: { operators, publication, clock }, onRequest: requireDashboardUser(access.sessions) };
  registerReadPublicationRoute(context);
  registerChangeOnlineRoute(context);
  ATTESTATION_KINDS.forEach((kind) => registerAttestationRoute(context, kind));
}

function registerReadPublicationRoute({ scope, sources, onRequest }: PublicationRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response: { 200: lotPublicationSchema } };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/publication', { onRequest, attachValidation: true, schema }, (request): Promise<LotPublication> => {
    refuseMalformedRequest(request);
    return readPublicationOfMember(sources, memberLotOf(request));
  });
}

function registerChangeOnlineRoute({ scope, sources, onRequest }: PublicationRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: lotOnlineBodySchema, response: { 200: lotPublicationSchema } };
  type ChangeOnline = { readonly Params: LotParams; readonly Body: LotOnlineRequest };
  scope.put<ChangeOnline>('/v1/dashboard/lots/:id/online', { onRequest, attachValidation: true, schema }, (request): Promise<LotPublication> => {
    refuseMalformedRequest(request);
    return changeOnlineOfMember(sources, memberLotOf(request), request.body);
  });
}

// One fixed route per kind: the path never names a column.
function registerAttestationRoute({ scope, sources, onRequest }: PublicationRoutesContext, kind: AttestationKind): void {
  const path = `/v1/dashboard/lots/:id/attestations/${ATTESTATION_PATH_SEGMENTS[kind]}`;
  const schema = { params: lotIdParametersSchema, body: attestationBodySchema, response: { 200: lotPublicationSchema } };
  type Attest = { readonly Params: LotParams; readonly Body: Attestation };
  scope.put<Attest>(path, { onRequest, attachValidation: true, schema }, (request): Promise<LotPublication> => {
    refuseMalformedRequest(request);
    return attestOfMember(sources, { ...memberLotOf(request), kind, attestation: request.body });
  });
}

import type { GateIdentity, GatePassageRequest, GatePassageResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';
import type { PassageLedger } from '../../domain/gates/PassageLedger.ts';
import { recordPassage } from '../../domain/gates/recordPassage.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { authenticatedGateOf, createGateDeviceAuthentication } from '../gates/gateDeviceAuthentication.ts';
import { handleGateError } from '../gates/handleGateError.ts';
import {
  gateIdentitySchema,
  gateIdParametersSchema,
  passageRequestSchema,
  passageResponseSchema,
  type GateIdParameters,
} from '../schemas/gateSchemas.ts';

export interface GateRouteDependencies {
  readonly deviceKeys: GateDeviceKeyRepository;
  readonly ledger: PassageLedger;
  readonly clock: Clock;
}

interface PassageRoute {
  Params: GateIdParameters;
  Body: GatePassageRequest;
}

export function registerGateRoutes(server: FastifyInstance, dependencies: GateRouteDependencies): void {
  void server.register(
    async (scope) => {
      scope.decorateRequest('authenticatedGate', null);
      scope.addHook('onRequest', createGateDeviceAuthentication(dependencies.deviceKeys));
      scope.setErrorHandler(handleGateError);
      registerIdentityRoute(scope);
      registerPassageRoute(scope, dependencies);
    },
    { prefix: '/v1/gates' },
  );
}

function registerIdentityRoute(scope: FastifyInstance): void {
  scope.get('/me', { schema: { response: { 200: gateIdentitySchema } } }, async (request): Promise<GateIdentity> => {
    const gate = authenticatedGateOf(request);
    return { id: gate.id, name: gate.name, kind: gate.kind, lotName: gate.lotName };
  });
}

function registerPassageRoute(scope: FastifyInstance, dependencies: GateRouteDependencies): void {
  const schema = { params: gateIdParametersSchema, body: passageRequestSchema, response: { 200: passageResponseSchema } };
  scope.post<PassageRoute>('/:id/passage', { schema }, async (request): Promise<GatePassageResponse> => {
    const command = {
      gate: authenticatedGateOf(request),
      requestedGateId: request.params.id,
      closedAt: new Date(request.body.closedAt),
    };
    return recordPassage(command, { ledger: dependencies.ledger, clock: dependencies.clock });
  });
}

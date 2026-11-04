import type { GateIdentity, GatePassageRequest, GatePassageResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { GateCommandCursor, GateCommandFeed } from '../../domain/gates/GateCommandFeed.ts';
import type { GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import type { PassageLedger } from '../../domain/gates/PassageLedger.ts';
import { recordPassage } from '../../domain/gates/recordPassage.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { authenticatedGateOf, createGateDeviceAuthentication } from '../gates/gateDeviceAuthentication.ts';
import { handleGateError } from '../gates/handleGateError.ts';
import { gateCommandListSchema, gateCommandsQuerySchema, type GateCommandsQuery } from '../schemas/entrySchemas.ts';
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
  readonly commands: GateCommandFeed;
  readonly openingWindow: OpeningWindow;
}

const BAD_REQUEST = 400;
const FIRST_STORABLE_YEAR = 1;

interface CommandsRoute {
  Querystring: GateCommandsQuery;
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
      registerCommandsRoute(scope, dependencies.commands);
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
    return recordPassage(command, { ledger: dependencies.ledger, clock: dependencies.clock, openingWindow: dependencies.openingWindow });
  });
}

// The demo console polls this with the issuedAt and id of the last command it shows, so each poll brings only new ones.
function registerCommandsRoute(scope: FastifyInstance, commands: GateCommandFeed): void {
  const schema = { querystring: gateCommandsQuerySchema, response: { 200: gateCommandListSchema } };
  scope.get<CommandsRoute>('/me/commands', { schema }, async (request, reply) => {
    const cursor = cursorOf(request.query);
    if (cursor.kind === 'invalid') {
      return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'AFTER_INVALID', message: 'after and afterId do not form a cursor the server can read.' });
    }
    return commands.listCommands(authenticatedGateOf(request).id, cursor.kind === 'after' ? cursor.after : null);
  });
}

type CommandsCursor = { readonly kind: 'latest' } | { readonly kind: 'invalid' } | { readonly kind: 'after'; readonly after: GateCommandCursor };

function cursorOf({ after, afterId }: GateCommandsQuery): CommandsCursor {
  if (after === undefined && afterId === undefined) {
    return { kind: 'latest' };
  }
  if (after === undefined || afterId === undefined) {
    return { kind: 'invalid' };
  }
  const issuedAt = new Date(after);
  return isStorableDate(issuedAt) ? { kind: 'after', after: { issuedAt, id: afterId } } : { kind: 'invalid' };
}

// Also false for an invalid date, whose year is NaN.
function isStorableDate(date: Date): boolean {
  return date.getUTCFullYear() >= FIRST_STORABLE_YEAR;
}

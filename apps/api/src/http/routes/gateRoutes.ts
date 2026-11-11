import type { GateIdentifyRequest, GateIdentifyResponse, GateIdentity, GatePassageRequest, GatePassageResponse } from '@palier/shared-types';
import { isStorableDate } from '../../domain/time/storableDate.ts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { GateCommandCursor, GateCommandFeed } from '../../domain/gates/GateCommandFeed.ts';
import type { GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';
import type { OpeningWindow } from '../../domain/gates/OpeningWindow.ts';
import type { PassageLedger } from '../../domain/gates/PassageLedger.ts';
import type { ExitDependencies } from '../../domain/exits/exitParking.ts';
import { identifyAtExit, type IdentifyOutcome } from '../../domain/exits/identifyAtExit.ts';
import { recordPassage } from '../../domain/gates/recordPassage.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { authenticatedGateOf, createGateDeviceAuthentication } from '../gates/gateDeviceAuthentication.ts';
import { handleGateError } from '../gates/handleGateError.ts';
import { gateCommandListSchema, gateCommandsQuerySchema, type GateCommandsQuery } from '../schemas/entrySchemas.ts';
import {
  gateIdentitySchema,
  gateIdParametersSchema,
  identifyRequestSchema,
  identifyResponseSchema,
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
const SERVICE_UNAVAILABLE = 503;

interface CommandsRoute {
  Querystring: GateCommandsQuery;
}

interface PassageRoute {
  Params: GateIdParameters;
  Body: GatePassageRequest;
}

interface IdentifyRoute {
  Params: GateIdParameters;
  Body: GateIdentifyRequest;
}

export interface ReaderExitDependencies {
  readonly exit: ExitDependencies;
  // The clock of the tap, so a reader prices the stay and stamps the exit as the tap does (the test clock when it is active).
  readonly clock: Clock;
}

// The reader exit is missing in a server composed without payments: a reader then gets 503, like the tap.
export function registerGateRoutes(server: FastifyInstance, dependencies: GateRouteDependencies, readerExit?: ReaderExitDependencies): void {
  void server.register(
    async (scope) => {
      scope.decorateRequest('authenticatedGate', null);
      scope.addHook('onRequest', createGateDeviceAuthentication(dependencies.deviceKeys));
      scope.setErrorHandler(handleGateError);
      registerIdentityRoute(scope);
      registerPassageRoute(scope, dependencies);
      registerIdentifyRoute(scope, readerExit);
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

// The exit reader read a plate or a transponder: the same exit as the tap, for the one open session that has it.
function registerIdentifyRoute(scope: FastifyInstance, readerExit: ReaderExitDependencies | undefined): void {
  const schema = { params: gateIdParametersSchema, body: identifyRequestSchema, response: { 200: identifyResponseSchema } };
  scope.post<IdentifyRoute>('/:id/identify', { schema }, async (request, reply): Promise<GateIdentifyResponse | FastifyReply> => {
    if (readerExit === undefined) {
      return reply.status(SERVICE_UNAVAILABLE).send({ statusCode: SERVICE_UNAVAILABLE, error: 'PAYMENTS_UNAVAILABLE', message: 'The payment could not be taken; try again.' });
    }
    const { id: requestedGateId } = request.params;
    const gate = authenticatedGateOf(request);
    const identified = await identifyAtExit(readerExit.exit, { gate, requestedGateId, identifier: request.body.identifier, now: readerExit.clock() });
    return identifyReply(identified, request, reply);
  });
}

function identifyReply(identified: IdentifyOutcome, request: FastifyRequest<IdentifyRoute>, reply: FastifyReply): GateIdentifyResponse | FastifyReply {
  if (identified.outcome === 'opened') {
    return { outcome: 'opened', identification: identified.identification };
  }
  if (identified.outcome === 'fallback') {
    return { outcome: 'fallback', identification: null };
  }
  request.log.warn({ gateId: request.params.id, reason: identified.outcome }, 'exit reader request refused');
  const error = identified.outcome.toUpperCase().replace('-', '_');
  return reply.status(SERVICE_UNAVAILABLE).send({ statusCode: SERVICE_UNAVAILABLE, error, message: 'The exit could not be completed; use the app.' });
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

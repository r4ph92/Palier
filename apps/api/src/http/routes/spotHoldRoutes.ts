import type { CurrentSpotHoldResponse, SpotHold as SpotHoldBody } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { releaseSpotHold, type SpotHoldReleaseDependencies } from '../../domain/spotHolds/releaseSpotHold.ts';
import { requestSpotHold, type SpotHoldRequestDependencies } from '../../domain/spotHolds/requestSpotHold.ts';
import type { SpotHold } from '../../domain/spotHolds/SpotHold.ts';
import { SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldRepository } from '../../domain/spotHolds/SpotHoldRepository.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { currentSpotHoldResponseSchema, spotHoldPathParametersSchema, spotHoldSchema, type SpotHoldPathParameters } from '../schemas/spotHoldSchemas.ts';
import { handleSpotHoldError } from '../spotHolds/handleSpotHoldError.ts';

const CREATED = 201;
const NO_CONTENT = 204;

export interface SpotHoldServices extends Omit<SpotHoldRequestDependencies, 'clock' | 'spotHolds'> {
  readonly spotHolds: SpotHoldRepository;
}

export interface SpotHoldRouteDependencies {
  // main.ts always passes them; without them both routes answer 503 HOLD_UNAVAILABLE.
  readonly services: SpotHoldServices | undefined;
  readonly clock: Clock;
}

interface SpotHoldPathRoute {
  readonly Params: SpotHoldPathParameters;
}

// Guards run as onRequest, before the path is validated: a driver without a token or consent learns nothing about lot ids.
type Guards = ReturnType<typeof consentedDriverGuards>;

export function registerSpotHoldRoutes(server: FastifyInstance, driverAccess: DriverAccess, dependencies: SpotHoldRouteDependencies): void {
  const onRequest = consentedDriverGuards(driverAccess);
  void server.register(async (scope) => {
    scope.setErrorHandler(handleSpotHoldError);
    registerPlaceRoute(scope, onRequest, dependencies);
    registerReleaseRoute(scope, onRequest, dependencies);
    registerReadRoute(scope, onRequest, dependencies);
  });
}

function registerPlaceRoute(scope: FastifyInstance, onRequest: Guards, { services, clock }: SpotHoldRouteDependencies): void {
  const requests = services === undefined ? null : { ...services, clock };
  scope.post<SpotHoldPathRoute>(
    '/v1/lots/:id/holds',
    { onRequest, schema: { params: spotHoldPathParametersSchema, response: { [CREATED]: spotHoldSchema } } },
    (request, reply) => holdSpot(requests, request, reply),
  );
}

function registerReleaseRoute(scope: FastifyInstance, onRequest: Guards, { services, clock }: SpotHoldRouteDependencies): void {
  const releases = services === undefined ? null : { spotHolds: services.spotHolds, clock };
  scope.delete<SpotHoldPathRoute>(
    '/v1/holds/:id',
    { onRequest, schema: { params: spotHoldPathParametersSchema } },
    (request, reply) => releaseOwnSpotHold(releases, request, reply),
  );
}

function registerReadRoute(scope: FastifyInstance, onRequest: Guards, { services, clock }: SpotHoldRouteDependencies): void {
  scope.get('/v1/me/hold', { onRequest, schema: { response: { 200: currentSpotHoldResponseSchema } } }, (request) =>
    currentSpotHold({ repository: services?.spotHolds, clock }, request),
  );
}

async function holdSpot(requests: SpotHoldRequestDependencies | null, request: FastifyRequest<SpotHoldPathRoute>, reply: FastifyReply) {
  if (requests === null) {
    throw new SpotHoldRefusedError('HOLD_UNAVAILABLE');
  }
  const { spotHold, now } = await requestSpotHold(requests, { driverId: signedInDriver(request).id, lotId: request.params.id });
  return reply.status(CREATED).send(spotHoldBody(spotHold, now));
}

async function releaseOwnSpotHold(releases: SpotHoldReleaseDependencies | null, request: FastifyRequest<SpotHoldPathRoute>, reply: FastifyReply) {
  if (releases === null) {
    throw new SpotHoldRefusedError('HOLD_UNAVAILABLE');
  }
  await releaseSpotHold(releases, { driverId: signedInDriver(request).id, spotHoldId: request.params.id });
  return reply.status(NO_CONTENT).send();
}

interface CurrentSpotHoldSources {
  readonly repository: SpotHoldRepository | undefined;
  readonly clock: Clock;
}

// No hold id in the path: a driver only ever reads their own hold, so there is nothing to probe.
async function currentSpotHold({ repository, clock }: CurrentSpotHoldSources, request: FastifyRequest): Promise<CurrentSpotHoldResponse> {
  if (repository === undefined) {
    throw new SpotHoldRefusedError('HOLD_UNAVAILABLE');
  }
  const spotHold = await repository.findActiveSpotHold(signedInDriver(request).id);
  return { spotHold: spotHold === null ? null : spotHoldBody(spotHold, clock()) };
}

function spotHoldBody(spotHold: SpotHold, now: Date): SpotHoldBody {
  return { spotHoldId: spotHold.id, lotId: spotHold.lotId, lotName: spotHold.lotName, expiresAt: spotHold.expiresAt.toISOString(), now: now.toISOString() };
}

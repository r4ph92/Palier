import type { CurrentSpotHoldResponse, SpotHold as SpotHoldBody } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { releaseSpotHold } from '../../domain/spotHolds/releaseSpotHold.ts';
import { requestSpotHold, type SpotHoldRequestDependencies } from '../../domain/spotHolds/requestSpotHold.ts';
import type { SpotHold } from '../../domain/spotHolds/SpotHold.ts';
import { RELEASE_UNAVAILABLE_MESSAGE, SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldRepository } from '../../domain/spotHolds/SpotHoldRepository.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import {
  currentSpotHoldResponseSchema,
  spotHoldIdParametersSchema,
  spotHoldLotParametersSchema,
  spotHoldSchema,
  type SpotHoldIdParameters,
  type SpotHoldLotParameters,
} from '../schemas/spotHoldSchemas.ts';
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

interface PlaceRoute {
  readonly Params: SpotHoldLotParameters;
}

interface ReleaseRoute {
  readonly Params: SpotHoldIdParameters;
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
  scope.post<PlaceRoute>(
    '/v1/lots/:id/holds',
    { onRequest, config: { invalidPathRefusal: 'LOT_NOT_FOUND' }, schema: { params: spotHoldLotParametersSchema, response: { [CREATED]: spotHoldSchema } } },
    async (request, reply) => {
      const requests = { ...requireSpotHoldServices(services), clock };
      const { spotHold, now } = await requestSpotHold(requests, { driverId: signedInDriver(request).id, lotId: request.params.id });
      return reply.status(CREATED).send(spotHoldBody(spotHold, now));
    },
  );
}

function registerReleaseRoute(scope: FastifyInstance, onRequest: Guards, { services, clock }: SpotHoldRouteDependencies): void {
  scope.delete<ReleaseRoute>(
    '/v1/holds/:id',
    { onRequest, config: { invalidPathRefusal: 'HOLD_NOT_FOUND' }, schema: { params: spotHoldIdParametersSchema } },
    async (request, reply) => {
      const { spotHolds } = requireSpotHoldServices(services, RELEASE_UNAVAILABLE_MESSAGE);
      await releaseSpotHold({ spotHolds, clock }, { driverId: signedInDriver(request).id, spotHoldId: request.params.id });
      return reply.status(NO_CONTENT).send();
    },
  );
}

// No hold id in the path: a driver only ever reads their own hold, so there is nothing to probe.
function registerReadRoute(scope: FastifyInstance, onRequest: Guards, { services, clock }: SpotHoldRouteDependencies): void {
  scope.get('/v1/me/hold', { onRequest, schema: { response: { 200: currentSpotHoldResponseSchema } } }, async (request): Promise<CurrentSpotHoldResponse> => {
    const spotHold = await requireSpotHoldServices(services).spotHolds.findActiveSpotHold(signedInDriver(request).id);
    return { spotHold: spotHold === null ? null : spotHoldBody(spotHold, clock()) };
  });
}

function requireSpotHoldServices(services: SpotHoldServices | undefined, message?: string): SpotHoldServices {
  if (services === undefined) {
    throw new SpotHoldRefusedError('HOLD_UNAVAILABLE', message === undefined ? undefined : { message });
  }
  return services;
}

function spotHoldBody(spotHold: SpotHold, now: Date): SpotHoldBody {
  return { spotHoldId: spotHold.id, lotId: spotHold.lotId, lotName: spotHold.lotName, expiresAt: spotHold.expiresAt.toISOString(), now: now.toISOString() };
}

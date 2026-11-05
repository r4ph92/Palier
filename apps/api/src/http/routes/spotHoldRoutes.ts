import type { CurrentSpotHoldResponse, SpotHold as SpotHoldBody } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverPrerequisiteSources } from '../../domain/drivers/driverPrerequisites.ts';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { EntryPolicy } from '../../domain/entries/EntryEligibility.ts';
import { requestSpotHold, type SpotHoldRequestDependencies } from '../../domain/spotHolds/requestSpotHold.ts';
import type { SpotHold } from '../../domain/spotHolds/SpotHold.ts';
import { SPOT_HOLD_ATTEMPT_LIMIT, SPOT_HOLD_ATTEMPT_WINDOW_MILLISECONDS } from '../../domain/spotHolds/spotHoldAttemptLimit.ts';
import { SpotHoldEligibility } from '../../domain/spotHolds/SpotHoldEligibility.ts';
import { SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldRepository } from '../../domain/spotHolds/SpotHoldRepository.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { createSetupLimiter } from '../SetupLimiter.ts';
import { currentSpotHoldResponseSchema, spotHoldLotParametersSchema, spotHoldSchema, type SpotHoldLotParameters } from '../schemas/spotHoldSchemas.ts';
import { handleSpotHoldError } from '../spotHolds/handleSpotHoldError.ts';

const CREATED = 201;

export interface SpotHoldServices {
  readonly repository: SpotHoldRepository;
  readonly policy: EntryPolicy;
}

export interface SpotHoldRouteDependencies {
  // main.ts always passes them; without them both routes answer 503 HOLD_UNAVAILABLE.
  readonly services: SpotHoldServices | undefined;
  readonly prerequisites: DriverPrerequisiteSources;
  readonly clock: Clock;
}

interface HoldSpotRoute {
  readonly Params: SpotHoldLotParameters;
}

// Guards run as onRequest, before the path is validated: a driver without a token or consent learns nothing about lot ids.
export function registerSpotHoldRoutes(server: FastifyInstance, driverAccess: DriverAccess, dependencies: SpotHoldRouteDependencies): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const requests = spotHoldRequestsOf(dependencies);
  void server.register(async (scope) => {
    scope.setErrorHandler(handleSpotHoldError);
    scope.post<HoldSpotRoute>(
      '/v1/lots/:id/holds',
      { onRequest, schema: { params: spotHoldLotParametersSchema, response: { [CREATED]: spotHoldSchema } } },
      (request, reply) => holdSpot(requests, request, reply),
    );
    scope.get('/v1/me/hold', { onRequest, schema: { response: { 200: currentSpotHoldResponseSchema } } }, (request) =>
      currentSpotHold({ repository: dependencies.services?.repository, clock: dependencies.clock }, request),
    );
  });
}

function spotHoldRequestsOf({ services, prerequisites, clock }: SpotHoldRouteDependencies): SpotHoldRequestDependencies | null {
  if (services === undefined) {
    return null;
  }
  return {
    eligibility: new SpotHoldEligibility({ prerequisites, spotHolds: services.repository, policy: services.policy }),
    spotHolds: services.repository,
    attempts: createSetupLimiter(SPOT_HOLD_ATTEMPT_LIMIT, SPOT_HOLD_ATTEMPT_WINDOW_MILLISECONDS),
    clock,
  };
}

async function holdSpot(requests: SpotHoldRequestDependencies | null, request: FastifyRequest<HoldSpotRoute>, reply: FastifyReply) {
  if (requests === null) {
    throw new SpotHoldRefusedError('HOLD_UNAVAILABLE');
  }
  const { spotHold, now } = await requestSpotHold(requests, { driverId: signedInDriver(request).id, lotId: request.params.id });
  return reply.status(CREATED).send(spotHoldBody(spotHold, now));
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

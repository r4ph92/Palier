import type { FastifyRequest } from 'fastify';
import type { MemberSpot } from '../../domain/dashboard/lotSpots.ts';
import type { MemberLot } from '../../domain/dashboard/memberOperator.ts';
import { refuseMalformedLotId } from './refuseMalformedLotId.ts';
import { signedInDashboardUser } from './requireDashboardUser.ts';

export interface LotParams {
  readonly id: string;
}

export interface SpotParams extends LotParams {
  readonly spotId: string;
}

export const SPOT_ROUTE = '/v1/dashboard/lots/:id/spots/:spotId';

export interface AisleParams extends LotParams {
  readonly aisleId: string;
}

// A malformed id answers 404 like the read; a malformed body is the caller's mistake and answers 400.
export function refuseMalformedRequest(request: FastifyRequest): void {
  refuseMalformedLotId(request);
  if (request.validationError !== undefined) {
    throw request.validationError;
  }
}

export function memberLotOf(request: FastifyRequest<{ readonly Params: LotParams }>): MemberLot {
  return { userId: signedInDashboardUser(request).id, lotId: request.params.id };
}

export function memberSpotOf(request: FastifyRequest<{ readonly Params: SpotParams }>): MemberSpot {
  return { ...memberLotOf(request), spotId: request.params.spotId };
}

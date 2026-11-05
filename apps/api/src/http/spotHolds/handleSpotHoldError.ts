import type { SpotHoldRefusalBody, SpotHoldRefusalCode } from '@palier/shared-types';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import { handleServerError } from '../handleServerError.ts';
import { logLotRefusalCause } from '../logLotRefusalCause.ts';

const STATUS_BY_REASON: Record<SpotHoldRefusalCode, number> = {
  PREREQUISITES_MISSING: 409,
  HOLD_ALREADY_EXISTS: 409,
  HOLD_QUOTA_REACHED: 409,
  NO_SUITABLE_SPOT: 409,
  LOT_NOT_FOUND: 404,
  LOT_NOT_IN_SERVICE: 409,
  HOLD_UNAVAILABLE: 503,
  TOO_MANY_HOLD_ATTEMPTS: 429,
  HOLD_NOT_FOUND: 404,
  HOLD_EXPIRED: 409,
};

export function handleSpotHoldError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const refusal = refusalOf(error, request);
  if (refusal === undefined) {
    return handleServerError(error, request, reply);
  }
  logLotRefusalCause(refusal.cause, request, 'spot hold refused');
  const statusCode = STATUS_BY_REASON[refusal.reason];
  const body: SpotHoldRefusalBody = { statusCode, error: refusal.reason, message: refusal.message };
  return reply.status(statusCode).send(body);
}

// The path carries the only input, a lot id or a hold id: one that is not a UUID names nothing.
function refusalOf(error: FastifyError, request: FastifyRequest): SpotHoldRefusedError | undefined {
  if (error instanceof SpotHoldRefusedError) {
    return error;
  }
  return error.validation === undefined ? undefined : new SpotHoldRefusedError(request.method === 'DELETE' ? 'HOLD_NOT_FOUND' : 'LOT_NOT_FOUND');
}

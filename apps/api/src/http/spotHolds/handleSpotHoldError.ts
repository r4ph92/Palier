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
};

export function handleSpotHoldError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const refusal = refusalOf(error);
  if (refusal === undefined) {
    return handleServerError(error, request, reply);
  }
  logLotRefusalCause(refusal.cause, request, 'spot hold refused');
  const statusCode = STATUS_BY_REASON[refusal.reason];
  const body: SpotHoldRefusalBody = { statusCode, error: refusal.reason, message: refusal.message };
  return reply.status(statusCode).send(body);
}

// The path carries the only input, the lot id: one that is not a UUID names no lot.
function refusalOf(error: FastifyError): SpotHoldRefusedError | undefined {
  if (error instanceof SpotHoldRefusedError) {
    return error;
  }
  return error.validation === undefined ? undefined : new SpotHoldRefusedError('LOT_NOT_FOUND');
}

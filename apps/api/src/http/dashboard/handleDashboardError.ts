import type { DashboardErrorCode } from '@palier/shared-types';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { LOT_LOCK_WAIT_SECONDS } from '../../domain/lots/lotLockWait.ts';
import { handleServerError } from '../handleServerError.ts';
import { DashboardHttpRefusal } from './DashboardHttpRefusal.ts';

const STATUS_BY_REASON: Record<DashboardErrorCode, number> = {
  UNAUTHORIZED: 401,
  CSRF_HEADER_MISSING: 403,
  LEGAL_NAME_INVALID: 400,
  OPERATOR_EXISTS: 409,
  NO_OPERATOR: 409,
  LOT_NOT_FOUND: 404,
  OPERATOR_NOT_FOUND: 404,
  STRIPE_UNAVAILABLE: 503,
  LOT_NAME_REQUIRED: 400,
  LOT_NAME_INVALID: 400,
  LOT_ADDRESS_REQUIRED: 400,
  LOT_ADDRESS_INVALID: 400,
  LOT_LATITUDE_INVALID: 400,
  LOT_LONGITUDE_INVALID: 400,
  LOT_CAPACITY_INVALID: 400,
  PRICING_INCREMENT_CENTS_INVALID: 400,
  PRICING_INCREMENT_MINUTES_INVALID: 400,
  PRICING_DAILY_CAP_REQUIRED: 400,
  PRICING_DAILY_CAP_INVALID: 400,
  PRICING_DAILY_CAP_BELOW_INCREMENT: 400,
  PRICING_HOLD_QUOTA_INVALID: 400,
  TOO_MANY_LOTS: 429,
  LOT_BUSY: 503,
  LEVEL_CODE_INVALID: 400,
  LEVEL_CODE_TAKEN: 409,
  LEVEL_LIMIT_REACHED: 409,
  LEVEL_ORDER_INVALID: 409,
  LEVEL_NOT_FOUND: 404,
  AISLE_CODE_INVALID: 400,
  AISLE_CODE_TAKEN: 409,
  AISLE_CODE_RESERVED: 409,
  AISLE_MINOR_INVALID: 400,
  AISLE_MINOR_TAKEN: 409,
  AISLE_RECTANGLE_INVALID: 400,
  AISLE_NOT_FOUND: 404,
  SPOT_NOT_FOUND: 404,
  SPOT_RANGE_INVALID: 400,
  SPOT_DISTANCE_INVALID: 400,
  SPOT_LIMIT_REACHED: 409,
  SPOT_NUMBER_TAKEN: 409,
  SPOT_IN_USE: 409,
};

export function handleDashboardError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (!(error instanceof DashboardRefusedError || error instanceof DashboardHttpRefusal)) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[error.reason];
  if (error.reason === 'LOT_BUSY') {
    reply.header('Retry-After', LOT_LOCK_WAIT_SECONDS);
  }
  return reply.status(statusCode).send({ statusCode, error: error.reason, message: error.message, ...valuesOf(error) });
}

function valuesOf(error: DashboardRefusedError | DashboardHttpRefusal): { readonly values?: Readonly<Record<string, string>> } {
  return error instanceof DashboardRefusedError && Object.keys(error.values).length > 0 ? { values: error.values } : {};
}

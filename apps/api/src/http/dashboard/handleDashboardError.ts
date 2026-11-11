import type { DashboardErrorCode } from '@palier/shared-types';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
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
  LOT_NAME_INVALID: 400,
  LOT_ADDRESS_INVALID: 400,
  LOT_COORDINATES_INVALID: 400,
  LOT_CAPACITY_INVALID: 400,
  PRICING_INCREMENT_CENTS_INVALID: 400,
  PRICING_INCREMENT_MINUTES_INVALID: 400,
  PRICING_DAILY_CAP_REQUIRED: 400,
  PRICING_DAILY_CAP_INVALID: 400,
  PRICING_DAILY_CAP_BELOW_INCREMENT: 400,
  PRICING_HOLD_QUOTA_INVALID: 400,
  TOO_MANY_LOTS: 429,
};

export function handleDashboardError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (!(error instanceof DashboardRefusedError || error instanceof DashboardHttpRefusal)) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[error.reason];
  return reply.status(statusCode).send({ statusCode, error: error.reason, message: error.message });
}

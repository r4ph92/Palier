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
};

export function handleDashboardError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (!(error instanceof DashboardRefusedError || error instanceof DashboardHttpRefusal)) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[error.reason];
  return reply.status(statusCode).send({ statusCode, error: error.reason, message: error.message });
}

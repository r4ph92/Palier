import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { PassageRefusedError, type PassageRefusalReason } from '../../domain/gates/PassageRefusedError.ts';
import { handleServerError } from '../handleServerError.ts';

const STATUS_BY_REASON: Record<PassageRefusalReason, number> = {
  GATE_FORBIDDEN: 403,
  GATE_WITHOUT_LOOPS: 409,
  CLOSED_AT_IN_FUTURE: 400,
};

export function handleGateError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (!(error instanceof PassageRefusedError)) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[error.reason];
  return reply.status(statusCode).send({ statusCode, error: error.reason, message: error.message });
}

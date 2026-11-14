import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { EquipmentReportRefusedError, type EquipmentReportRefusalReason } from '../../domain/equipment/EquipmentReportRefusedError.ts';
import { PassageRefusedError, type PassageRefusalReason } from '../../domain/gates/PassageRefusedError.ts';
import { handleServerError } from '../handleServerError.ts';

const STATUS_BY_REASON: Record<PassageRefusalReason | EquipmentReportRefusalReason, number> = {
  GATE_FORBIDDEN: 403,
  GATE_WITHOUT_LOOPS: 409,
  CLOSED_AT_INVALID: 400,
  CLOSED_AT_IN_FUTURE: 400,
  GATE_WITHOUT_READER: 409,
  IDENTIFIER_INVALID: 400,
  GATE_NOT_EXIT: 409,
  REPLAY_KIND_MISMATCH: 409,
  REPLAY_IDS_REPEATED: 400,
  CLOSED_AT_TOO_OLD: 400,
  BEACON_NOT_FOUND: 404,
  BATTERY_PERCENT_INVALID: 400,
};

export function handleGateError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (!(error instanceof PassageRefusedError || error instanceof EquipmentReportRefusedError)) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[error.reason];
  return reply.status(statusCode).send({ statusCode, error: error.reason, message: error.message });
}

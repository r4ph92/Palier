import type { EntryRefusalBody, EntryRefusalCode } from '@palier/shared-types';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { handleServerError } from '../handleServerError.ts';

const STATUS_BY_REASON: Record<EntryRefusalCode, number> = {
  QR_NOT_RECOGNIZED: 400,
  NOT_AN_ENTRY_GATE: 409,
  LOT_NOT_IN_SERVICE: 409,
  GATE_UNAVAILABLE: 503,
  OPERATOR_NOT_PAYABLE: 409,
  PREREQUISITES_MISSING: 409,
  LOT_FULL: 409,
  ALREADY_INSIDE: 409,
  CARD_DECLINED: 402,
  PAYMENTS_UNAVAILABLE: 503,
  TOO_MANY_ENTRIES: 429,
};

export function handleEntryError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const refusal = refusalOf(error);
  if (refusal === undefined) {
    return handleServerError(error, request, reply);
  }
  const statusCode = STATUS_BY_REASON[refusal.reason];
  const body: EntryRefusalBody = { statusCode, error: refusal.reason, message: refusal.message };
  const { authorizedCents } = refusal;
  return reply.status(statusCode).send(authorizedCents === undefined ? body : { ...body, authorizedCents });
}

// A body the schema refuses carries no readable QR, so for the driver it is the same unrecognized QR.
function refusalOf(error: FastifyError): EntryRefusedError | undefined {
  if (error instanceof EntryRefusedError) {
    return error;
  }
  return error.validation === undefined ? undefined : new EntryRefusedError('QR_NOT_RECOGNIZED');
}

import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { FastifyBaseLogger, FastifyReply } from 'fastify';

const BAD_REQUEST = 400;
const CONFLICT = 409;
const SERVICE_UNAVAILABLE = 503;

// The same bodies on the walk, the answer and the spot-taken report: the app reads them the same way.
export const SESSION_CLOSED_BODY = { statusCode: CONFLICT, error: 'SESSION_CLOSED', message: 'This session is closed.' } as const;
export const LOT_BUSY_BODY = { statusCode: SERVICE_UNAVAILABLE, error: 'LOT_BUSY', message: 'The parking lot is busy; try again.' } as const;
export const ENTRY_NOT_CONFIRMED_BODY = {
  statusCode: CONFLICT,
  error: 'ENTRY_NOT_CONFIRMED',
  message: 'The entry loop has not confirmed this session yet.',
} as const;
const BLANK_SPOT_NUMBER_BODY = { statusCode: BAD_REQUEST, error: 'Bad Request', message: 'spotNumber is blank.' } as const;

export interface RefusalBody<Code extends string> {
  readonly statusCode: number;
  readonly error: Code;
  readonly message: string;
}

interface SessionRequest {
  readonly log: FastifyBaseLogger;
  readonly params: { readonly sessionId: string };
}

export type RefusalSender<Outcome extends string> = (outcome: Outcome, request: SessionRequest, reply: FastifyReply) => FastifyReply;

// A busy lot is logged: the lock wait ran out, which the operator may want to see.
export function refusalSender<Outcome extends string, Code extends string>(
  refusals: Readonly<Record<Outcome, RefusalBody<Code>>>,
  refusedRequest: string,
): RefusalSender<Outcome> {
  return (outcome, request, reply) => {
    if (outcome === 'lot-busy') {
      request.log.warn({ sessionId: request.params.sessionId }, `${refusedRequest} refused: the lot stayed locked past the lock timeout`);
    }
    const refusal = refusals[outcome];
    return reply.status(refusal.statusCode).send(refusal);
  };
}

// The schema admits « - » or spaces, which name no spot once normalized.
export function isBlankSpotNumber(spotNumber: string): boolean {
  return canonicalSpotNumber(spotNumber) === '';
}

export function replyBlankSpotNumber(reply: FastifyReply): FastifyReply {
  return reply.status(BAD_REQUEST).send(BLANK_SPOT_NUMBER_BODY);
}

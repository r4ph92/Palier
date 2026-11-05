import type { FastifyRequest } from 'fastify';
import { LotBusyError } from '../domain/entries/LotBusyError.ts';
import { PricingPolicyInvalidError } from '../domain/pricing/PricingPolicy.ts';

// The driver only sees the refusal; the log says which lot problem was behind it.
export function logLotRefusalCause(cause: unknown, request: FastifyRequest, refused: string): void {
  if (cause instanceof PricingPolicyInvalidError) {
    request.log.warn({ lotId: cause.lotId, err: cause }, `${refused}: the lot has no usable pricing policy`);
  }
  if (cause instanceof LotBusyError) {
    request.log.warn({ lotId: cause.lotId, err: cause }, `${refused}: the lot stayed locked past the lock timeout`);
  }
}

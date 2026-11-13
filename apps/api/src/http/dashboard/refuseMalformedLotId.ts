import type { FastifyRequest } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';

// A malformed id gets the same 404 as another operator's lot, so the answer never tells the two apart.
export function refuseMalformedLotId(request: FastifyRequest): void {
  if (request.validationError?.validationContext === 'params') {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
}

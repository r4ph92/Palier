import type { FastifyRequest } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { uuidSchema } from '../schemas/uuidSchema.ts';

const UUID = new RegExp(uuidSchema.pattern);

// A malformed lot id answers the lot's 404 and a malformed session id the session's, each like an id that matches nothing.
export function refuseMalformedSessionRequest(request: FastifyRequest<{ readonly Params: { readonly id: string } }>): void {
  if (request.validationError?.validationContext !== 'params') {
    return;
  }
  throw new DashboardRefusedError(UUID.test(request.params.id) ? 'SESSION_NOT_FOUND' : 'LOT_NOT_FOUND');
}

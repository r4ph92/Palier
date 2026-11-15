import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MemberGate } from '../../domain/dashboard/lotGates.ts';
import { memberLotOf, type LotParams } from './memberRequest.ts';

export interface GateParams extends LotParams {
  readonly gateId: string;
}

// Lower case, as Postgres writes a uuid: the QR token accepts no other spelling of the gate id.
export function memberGateOf(request: FastifyRequest<{ readonly Params: GateParams }>): MemberGate {
  return { ...memberLotOf(request), gateId: request.params.gateId.toLowerCase() };
}

// An answer carrying a device key or a signed QR link is never kept by a browser or a proxy.
export function keptNowhere(reply: FastifyReply): FastifyReply {
  return reply.header('Cache-Control', 'no-store');
}

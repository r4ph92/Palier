import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import type { AuthenticatedGate } from '../../domain/gates/AuthenticatedGate.ts';
import { authenticateDeviceKey } from '../../domain/gates/authenticateDeviceKey.ts';
import type { GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedGate: AuthenticatedGate | null;
  }
}

const UNAUTHORIZED = 401;
const BEARER_DEVICE_KEY = /^Bearer ([A-Za-z0-9_-]{43})$/;

export function createGateDeviceAuthentication(repository: GateDeviceKeyRepository): onRequestAsyncHookHandler {
  return async function authenticateGateDevice(request: FastifyRequest, reply: FastifyReply) {
    const deviceKey = BEARER_DEVICE_KEY.exec(request.headers.authorization ?? '')?.[1];
    const gate = deviceKey === undefined ? undefined : await authenticateDeviceKey(deviceKey, repository);
    if (gate === undefined) {
      return refuseDeviceKey(reply);
    }
    request.authenticatedGate = gate;
  };
}

export function authenticatedGateOf(request: FastifyRequest): AuthenticatedGate {
  if (request.authenticatedGate === null) {
    throw new Error('Gate routes must run behind the device-key authentication hook.');
  }
  return request.authenticatedGate;
}

function refuseDeviceKey(reply: FastifyReply): FastifyReply {
  return reply
    .status(UNAUTHORIZED)
    .header('www-authenticate', 'Bearer')
    .send({ statusCode: UNAUTHORIZED, error: 'DEVICE_KEY_REFUSED', message: 'Device key refused.' });
}

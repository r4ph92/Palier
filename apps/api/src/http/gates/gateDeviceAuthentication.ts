import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import type { AuthenticatedGate } from '../../domain/gates/AuthenticatedGate.ts';
import { authenticateDeviceKey } from '../../domain/gates/authenticateDeviceKey.ts';
import type { GateDeviceKeyRepository } from '../../domain/gates/GateDeviceKeyRepository.ts';
import { hashDeviceKey } from '../../domain/gates/hashDeviceKey.ts';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedGate: AuthenticatedGate | null;
    authenticatedKeyHash: string | null;
  }
}

const UNAUTHORIZED = 401;
const BEARER_DEVICE_KEY = /^Bearer ([A-Za-z0-9_-]{43})$/;

export function createGateDeviceAuthentication(repository: GateDeviceKeyRepository): onRequestAsyncHookHandler {
  return async function authenticateGateDevice(request: FastifyRequest, reply: FastifyReply) {
    const deviceKey = BEARER_DEVICE_KEY.exec(request.headers.authorization ?? '')?.[1];
    if (deviceKey === undefined) {
      return refuseDeviceKey(reply);
    }
    const gate = await authenticateDeviceKey(deviceKey, repository);
    if (gate === undefined) {
      return refuseDeviceKey(reply);
    }
    request.authenticatedGate = gate;
    request.authenticatedKeyHash = hashDeviceKey(deviceKey);
  };
}

export function authenticatedGateOf(request: FastifyRequest): AuthenticatedGate {
  if (request.authenticatedGate === null) {
    throw new Error('Gate routes must run behind the device-key authentication hook.');
  }
  return request.authenticatedGate;
}

// A write that must not outlive the key it came with checks it again in its own statement.
export function authenticatedKeyHashOf(request: FastifyRequest): string {
  if (request.authenticatedKeyHash === null) {
    throw new Error('Gate routes must run behind the device-key authentication hook.');
  }
  return request.authenticatedKeyHash;
}

function refuseDeviceKey(reply: FastifyReply): FastifyReply {
  return reply
    .status(UNAUTHORIZED)
    .header('www-authenticate', 'Bearer')
    .send({ statusCode: UNAUTHORIZED, error: 'DEVICE_KEY_REFUSED', message: 'Device key refused.' });
}

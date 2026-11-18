import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { authenticatedGateOf, authenticatedKeyHashOf } from '../../src/http/gates/gateDeviceAuthentication.ts';

describe('the authenticated gate of a request that skipped the device-key hook', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('is refused when the decoration is %s', (_case, value) => {
    const request = { authenticatedGate: value, authenticatedKeyHash: value } as unknown as FastifyRequest;

    expect(() => authenticatedGateOf(request)).toThrow('device-key authentication hook');
    expect(() => authenticatedKeyHashOf(request)).toThrow('device-key authentication hook');
  });
});

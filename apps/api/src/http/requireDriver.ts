import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Driver } from '../domain/drivers/Driver.ts';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import { authenticateDriver } from '../domain/drivers/driverSessions.ts';

const UNAUTHORIZED = 401;
const BEARER_PREFIX = 'Bearer ';

declare module 'fastify' {
  interface FastifyRequest {
    driver: Driver | null;
  }
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length);
  return token === '' ? null : token;
}

export function requireDriver(repository: DriverRepository): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request);
    request.driver = token === null ? null : await authenticateDriver(repository, token);
    if (request.driver === null) {
      return reply
        .status(UNAUTHORIZED)
        .send({ statusCode: UNAUTHORIZED, error: 'Unauthorized', message: 'A valid driver token is required.' });
    }
  };
}

export function signedInDriver(request: FastifyRequest): Driver {
  if (request.driver === null) {
    throw new Error('requireDriver must run before this handler.');
  }
  return request.driver;
}

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

const INTERNAL_SERVER_ERROR = 500;

export function handleServerError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const statusCode = error.statusCode ?? INTERNAL_SERVER_ERROR;
  if (statusCode < INTERNAL_SERVER_ERROR) {
    return reply.status(statusCode).send({ statusCode, error: error.code, message: error.message });
  }
  request.log.error({ err: error }, 'request failed');
  return reply.status(statusCode).send({ statusCode, error: 'Internal Server Error' });
}

const NOT_FOUND = 404;

// Fastify's default 404 logs and echoes the whole URL, query string included: a position sent to a wrong path would
// reach the log (decision 015). This one names neither.
export function handleNotFound(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'Route not found.' });
}

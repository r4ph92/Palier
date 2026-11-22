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

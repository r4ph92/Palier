import type { FastifyReply, FastifyRequest } from 'fastify';

const NOT_FOUND = 404;

// Fastify's default 404 logs and echoes the whole URL, query string included: a position sent to a wrong path would
// reach the log (decision 015). This one names neither.
export function handleNotFound(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'Route not found.' });
}

import type { FastifyReply } from 'fastify';
import { createSetupLimiter, type SetupLimiter } from './SetupLimiter.ts';

const TOO_MANY_REQUESTS = 429;
// One address may sign in ten times a minute. Retry-After is the whole window, which is always enough to clear it.
const SIGN_IN_LIMIT = 10;
const SIGN_IN_WINDOW_MILLISECONDS = 60 * 1000;
const RETRY_AFTER_SECONDS = 60;

export function createSignInLimiter(): SetupLimiter {
  return createSetupLimiter(SIGN_IN_LIMIT, SIGN_IN_WINDOW_MILLISECONDS);
}

export function refuseTooManySignIns(reply: FastifyReply): FastifyReply {
  return reply
    .status(TOO_MANY_REQUESTS)
    .header('Retry-After', RETRY_AFTER_SECONDS)
    .send({ statusCode: TOO_MANY_REQUESTS, error: 'Too Many Requests', message: 'Too many sign-ins from this address.' });
}

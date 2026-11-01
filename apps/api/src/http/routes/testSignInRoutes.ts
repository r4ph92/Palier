import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { signInDriver } from '../../domain/drivers/driverSessions.ts';
import { signInResponseSchema, testDriverListSchema, testSignInBodySchema } from '../schemas/driverSchemas.ts';
import { createSetupLimiter, type SetupLimiter } from '../SetupLimiter.ts';

const NOT_FOUND = 404;
const TOO_MANY_REQUESTS = 429;
// One address may sign in ten times a minute. Retry-After is the whole window, which is always enough to clear it.
const SIGN_IN_LIMIT = 10;
const SIGN_IN_WINDOW_MILLISECONDS = 60 * 1000;
const RETRY_AFTER_SECONDS = 60;

interface TestSignInRequest {
  readonly Body: { readonly driverId: string };
}

// Registered only when test sign-in is enabled; otherwise these paths answer 404 like any unknown route.
export function registerTestSignInRoutes(server: FastifyInstance, repository: DriverRepository): void {
  const limiter = createSetupLimiter(SIGN_IN_LIMIT, SIGN_IN_WINDOW_MILLISECONDS);
  server.get(
    '/v1/test/drivers',
    { schema: { response: { 200: testDriverListSchema } } },
    (): Promise<TestDriverListResponse> => repository.listDrivers(),
  );

  server.post<TestSignInRequest>(
    '/v1/test/sign-in',
    { schema: { body: testSignInBodySchema, response: { 200: signInResponseSchema } } },
    (request, reply) => signInAsTestDriver({ repository, limiter }, request, reply),
  );
}

interface SignInDependencies {
  readonly repository: DriverRepository;
  readonly limiter: SetupLimiter;
}

async function signInAsTestDriver(
  { repository, limiter }: SignInDependencies,
  request: FastifyRequest<TestSignInRequest>,
  reply: FastifyReply,
): Promise<SignInResponse | FastifyReply> {
  if (!limiter.allow(request.ip)) {
    return reply
      .status(TOO_MANY_REQUESTS)
      .header('Retry-After', RETRY_AFTER_SECONDS)
      .send({ statusCode: TOO_MANY_REQUESTS, error: 'Too Many Requests', message: 'Too many sign-ins from this address.' });
  }
  const signedIn = await signInDriver(repository, request.body.driverId);
  if (signedIn === null) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'No such test driver.' });
  }
  const { token, driver } = signedIn;
  return { token, driver: { id: driver.id, firstName: driver.firstName } };
}

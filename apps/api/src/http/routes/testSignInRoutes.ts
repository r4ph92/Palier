import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DRIVER_PERSONA_IDS } from '../../config/testPersonas.ts';
import { signInDriver } from '../../domain/drivers/driverSessions.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';
import { signInResponseSchema, testDriverListSchema, testSignInBodySchema } from '../schemas/driverSchemas.ts';
import type { SetupLimiter } from '../SetupLimiter.ts';
import { createSignInLimiter, refuseTooManySignIns } from '../signInLimit.ts';

const NOT_FOUND = 404;

interface TestSignInRequest {
  readonly Body: { readonly driverId: string };
}

// Registered only when test sign-in is enabled; otherwise these paths answer 404 like any unknown route.
export function registerTestSignInRoutes(server: FastifyInstance, access: SessionAccess): void {
  const limiter = createSignInLimiter();
  server.get(
    '/v1/test/drivers',
    { schema: { response: { 200: testDriverListSchema } } },
    (): Promise<TestDriverListResponse> => access.users.findUsers(DRIVER_PERSONA_IDS),
  );

  server.post<TestSignInRequest>(
    '/v1/test/sign-in',
    { schema: { body: testSignInBodySchema, response: { 200: signInResponseSchema } } },
    (request, reply) => signInAsTestDriver({ access, limiter }, request, reply),
  );
}

interface SignInDependencies {
  readonly access: SessionAccess;
  readonly limiter: SetupLimiter;
}

async function signInAsTestDriver(
  { access, limiter }: SignInDependencies,
  request: FastifyRequest<TestSignInRequest>,
  reply: FastifyReply,
): Promise<SignInResponse | FastifyReply> {
  if (!limiter.allow(request.ip)) {
    return refuseTooManySignIns(reply);
  }
  const signedIn = await signInDriver(access, request.body.driverId);
  if (signedIn === null) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'No such test driver.' });
  }
  const { token, driver } = signedIn;
  return { token, driver: { id: driver.id, firstName: driver.firstName } };
}

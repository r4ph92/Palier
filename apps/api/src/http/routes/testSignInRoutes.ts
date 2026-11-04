import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { signInDriver, type DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { OPERATOR_PERSONA_IDS } from '../../config/testPersonas.ts';
import { signInResponseSchema, testDriverListSchema, testSignInBodySchema } from '../schemas/driverSchemas.ts';
import type { SetupLimiter } from '../SetupLimiter.ts';
import { createSignInLimiter, refuseTooManySignIns } from '../signInLimit.ts';

const NOT_FOUND = 404;

interface TestSignInRequest {
  readonly Body: { readonly driverId: string };
}

// Registered only when test sign-in is enabled; otherwise these paths answer 404 like any unknown route.
export function registerTestSignInRoutes(server: FastifyInstance, driverAccess: DriverAccess): void {
  const limiter = createSignInLimiter();
  server.get(
    '/v1/test/drivers',
    { schema: { response: { 200: testDriverListSchema } } },
    (): Promise<TestDriverListResponse> => listTestDrivers(driverAccess),
  );

  server.post<TestSignInRequest>(
    '/v1/test/sign-in',
    { schema: { body: testSignInBodySchema, response: { 200: signInResponseSchema } } },
    (request, reply) => signInAsTestDriver({ driverAccess, limiter }, request, reply),
  );
}

// Operator personas sign in to the dashboard only, so the app's test list never offers them.
async function listTestDrivers({ drivers }: DriverAccess): Promise<TestDriverListResponse> {
  return (await drivers.listDrivers()).filter((driver) => !OPERATOR_PERSONA_IDS.includes(driver.id));
}

interface SignInDependencies {
  readonly driverAccess: DriverAccess;
  readonly limiter: SetupLimiter;
}

async function signInAsTestDriver(
  { driverAccess, limiter }: SignInDependencies,
  request: FastifyRequest<TestSignInRequest>,
  reply: FastifyReply,
): Promise<SignInResponse | FastifyReply> {
  if (!limiter.allow(request.ip)) {
    return refuseTooManySignIns(reply);
  }
  const signedIn = await signInDriver(driverAccess, request.body.driverId);
  if (signedIn === null) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'No such test driver.' });
  }
  const { token, driver } = signedIn;
  return { token, driver: { id: driver.id, firstName: driver.firstName } };
}

import type { SignInResponse, TestDriverListResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { signInDriver } from '../../domain/drivers/driverSessions.ts';
import { signInResponseSchema, testDriverListSchema, testSignInBodySchema } from '../schemas/driverSchemas.ts';

const NOT_FOUND = 404;

interface TestSignInRequest {
  readonly Body: { readonly driverId: string };
}

// Registered only when test sign-in is enabled; otherwise these paths answer 404 like any unknown route.
export function registerTestSignInRoutes(server: FastifyInstance, repository: DriverRepository): void {
  server.get(
    '/v1/test/drivers',
    { schema: { response: { 200: testDriverListSchema } } },
    (): Promise<TestDriverListResponse> => repository.listDrivers(),
  );

  server.post<TestSignInRequest>(
    '/v1/test/sign-in',
    { schema: { body: testSignInBodySchema, response: { 200: signInResponseSchema } } },
    (request, reply) => signInAsTestDriver(repository, request, reply),
  );
}

async function signInAsTestDriver(
  repository: DriverRepository,
  request: FastifyRequest<TestSignInRequest>,
  reply: FastifyReply,
): Promise<SignInResponse | FastifyReply> {
  const signedIn = await signInDriver(repository, request.body.driverId);
  if (signedIn === null) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'Not Found', message: 'No such test driver.' });
  }
  const { token, driver } = signedIn;
  return { token, driver: { id: driver.id, firstName: driver.firstName } };
}

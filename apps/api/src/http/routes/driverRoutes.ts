import type { CurrentDriver } from '@palier/shared-types';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { signOutDriver } from '../../domain/drivers/driverSessions.ts';
import { bearerToken, requireDriver, signedInDriver } from '../requireDriver.ts';
import { acceptNoticeBodySchema, currentDriverSchema } from '../schemas/driverSchemas.ts';

const NO_CONTENT = 204;
const CONFLICT = 409;

interface AcceptNoticeRequest {
  readonly Body: { readonly noticeVersion: string };
}

export function registerDriverRoutes(server: FastifyInstance, repository: DriverRepository): void {
  const preHandler = requireDriver(repository);
  registerMeRoute(server, repository, preHandler);
  registerConsentRoute(server, repository, preHandler);

  server.post('/v1/sign-out', { preHandler }, async (request, reply) => {
    await signOutDriver(repository, bearerToken(request) ?? '');
    return reply.status(NO_CONTENT).send();
  });
}

function registerMeRoute(server: FastifyInstance, repository: DriverRepository, preHandler: preHandlerAsyncHookHandler): void {
  server.get('/v1/me', { preHandler, schema: { response: { 200: currentDriverSchema } } }, async (request): Promise<CurrentDriver> => {
    const driver = signedInDriver(request);
    return {
      id: driver.id,
      firstName: driver.firstName,
      acceptedNoticeVersion: await repository.findLatestNoticeVersion(driver.id),
    };
  });
}

function registerConsentRoute(server: FastifyInstance, repository: DriverRepository, preHandler: preHandlerAsyncHookHandler): void {
  // onRequest, not preHandler: body validation runs before preHandler, so an unauthenticated request must be refused first.
  server.post<AcceptNoticeRequest>('/v1/consent', { onRequest: preHandler, schema: { body: acceptNoticeBodySchema } }, async (request, reply) => {
    if (request.body.noticeVersion !== PRIVACY_NOTICE_VERSION) {
      return reply.status(CONFLICT).send({
        statusCode: CONFLICT,
        error: 'NOTICE_VERSION_OUTDATED',
        message: 'Another version of the privacy notice is in force.',
      });
    }
    await repository.saveNoticeAcceptance(signedInDriver(request).id, request.body.noticeVersion);
    return reply.status(NO_CONTENT).send();
  });
}

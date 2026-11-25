import type { CurrentDriver } from '@palier/shared-types';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { signOutDriver, type DriverAccess } from '../../domain/drivers/driverSessions.ts';
import { cleanName } from '../../domain/identity/signInWithIdentity.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { bearerToken, requireDriver, signedInDriver } from '../requireDriver.ts';
import { acceptNoticeBodySchema, currentDriverSchema, driverNameBodySchema } from '../schemas/driverSchemas.ts';

const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const CONFLICT = 409;

interface DriverNameRequest {
  readonly Body: { readonly firstName: string; readonly lastName: string };
}

interface AcceptNoticeRequest {
  readonly Body: { readonly noticeVersion: string };
}

export function registerDriverRoutes(server: FastifyInstance, { drivers, sessions }: DriverAccess): void {
  const preHandler = requireDriver(sessions);
  registerMeRoute(server, drivers, preHandler);
  registerConsentRoute(server, drivers, preHandler);
  registerNameRoute(server, { drivers, sessions });

  server.post('/v1/sign-out', { preHandler }, async (request, reply) => {
    await signOutDriver(sessions, bearerToken(request) ?? '');
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

// Apple and Google may give no name; the app asks for it once the notice is accepted, since the notice comes before any personal data.
function registerNameRoute(server: FastifyInstance, driverAccess: DriverAccess): void {
  const guards = consentedDriverGuards(driverAccess);
  server.put<DriverNameRequest>('/v1/me/name', { onRequest: guards, schema: { body: driverNameBodySchema } }, async (request, reply) => {
    const firstName = cleanName(request.body.firstName);
    if (firstName === '') {
      return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'FIRST_NAME_REQUIRED', message: 'A first name is required.' });
    }
    await driverAccess.drivers.saveName(signedInDriver(request).id, firstName, cleanName(request.body.lastName));
    return reply.status(NO_CONTENT).send();
  });
}

import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import { signedInDriver } from './requireDriver.ts';

const FORBIDDEN = 403;

// Runs after requireDriver: a driver who has not accepted the current notice gets nothing from the route.
export function requireConsent(repository: DriverRepository): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const accepted = await repository.hasLatestNoticeVersion(signedInDriver(request).id, PRIVACY_NOTICE_VERSION);
    if (!accepted) {
      return reply
        .status(FORBIDDEN)
        .send({ statusCode: FORBIDDEN, error: 'CONSENT_REQUIRED', message: 'Accept the privacy notice first.' });
    }
  };
}

import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { DriverRepository } from '../domain/drivers/DriverRepository.ts';
import type { DriverAccess } from '../domain/drivers/driverSessions.ts';
import { requireDriver, signedInDriver } from './requireDriver.ts';

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

// The pair every consent-gated route runs, in this order: a valid app token, then the current notice.
export function consentedDriverGuards({ drivers, sessions }: DriverAccess): preHandlerAsyncHookHandler[] {
  return [requireDriver(sessions), requireConsent(drivers)];
}

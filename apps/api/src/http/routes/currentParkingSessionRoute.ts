import type { CurrentParkingSession, CurrentParkingSessionResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ActiveParkingSession, CurrentParkingSessionQuery } from '../../domain/parkingSessions/ActiveParkingSession.ts';
import { priceParkingSessionAt } from '../../domain/pricing/priceParkingSessionAt.ts';
import type { Clock } from '../../domain/time/Clock.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { currentParkingSessionResponseSchema } from '../schemas/parkingSessionSchemas.ts';

export interface CurrentParkingSessionRouteDependencies {
  readonly sessions: CurrentParkingSessionQuery;
  readonly clock: Clock;
}

// No session id in the path: a driver only ever reads their own session, so there is nothing to probe.
export function registerCurrentParkingSessionRoute(
  server: FastifyInstance,
  driverAccess: DriverAccess,
  { sessions, clock }: CurrentParkingSessionRouteDependencies,
): void {
  const onRequest = consentedDriverGuards(driverAccess);
  const schema = { response: { 200: currentParkingSessionResponseSchema } };
  server.get('/v1/me/session', { onRequest, schema }, async (request): Promise<CurrentParkingSessionResponse> => {
    const session = await sessions.findCurrentParkingSessionForUser(signedInDriver(request).id);
    return { session: session === null ? null : currentParkingSessionAt(session, clock()) };
  });
}

function currentParkingSessionAt(session: ActiveParkingSession, now: Date): CurrentParkingSession {
  const { elapsedMinutes, amountCents } = priceParkingSessionAt(session, now);
  return {
    sessionId: session.id,
    state: session.state,
    lotName: session.lotName,
    spot: session.spot,
    enteredAt: session.enteredAt.toISOString(),
    elapsedMinutes,
    amountCents,
    dailyCapCents: session.pricing.dailyCapCents,
  };
}

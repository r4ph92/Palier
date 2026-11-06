import type { EntrySessionState } from '@palier/shared-types';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import type { StoredAnsweringSession, StoredSpot } from './fakes/fakeParkedAnswers.ts';

export const UNKNOWN_SPOT_BODY = { statusCode: 409, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' };
export const SPOT_TAKEN_BODY = { statusCode: 409, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' };

// Julie's session on her assigned A-1, not answered yet.
export function julieSessionIn(state: EntrySessionState): StoredAnsweringSession {
  return { driverId: julie.id, assignedSpotNumber: 'A-1', state, confirmedSpotNumber: null, answeredAt: null };
}

// Parking Démo with Julie's session and the spots the case needs; Julie and Marc both accepted the notice.
export async function julieWithAnsweringSession(session: StoredAnsweringSession, spots: Readonly<Record<string, StoredSpot>>) {
  const configured = configureServer();
  const { server, parkedAnswers, driverRepository } = configured;
  parkedAnswers.add(JULIE_SESSION_ID, session);
  Object.entries(spots).forEach(([number, spot]) => parkedAnswers.setSpot(number, spot));
  await acceptNoticeAs(driverRepository, julie);
  await acceptNoticeAs(driverRepository, marc);
  const julieHeaders = await authorizationFor(driverRepository, julie);
  const answer = (spotNumber: unknown, headers: Record<string, string> = julieHeaders) =>
    server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber } });
  return { ...configured, answer };
}

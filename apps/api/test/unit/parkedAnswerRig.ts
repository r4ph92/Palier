import type { EntrySessionState } from '@palier/shared-types';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, amelie, authorizationFor, julie, marc } from './fakeDriverRepository.ts';
import { JULIE_SESSION_ID } from './fakes/fakeCurrentParkingSessions.ts';
import { electricWithPermitNeeds } from './fakeVehicleRepository.ts';
import type { StoredAnsweringSession, StoredSpot } from './fakes/fakeParkedAnswers.ts';

export const UNKNOWN_SPOT_BODY = { statusCode: 409, error: 'UNKNOWN_SPOT', message: 'No spot has this number in this parking lot.' };
export const SPOT_NOT_SUITABLE_BODY = { statusCode: 409, error: 'SPOT_NOT_SUITABLE', message: 'This spot does not suit your vehicle.' };
export const SPOT_TAKEN_BODY = { statusCode: 409, error: 'SPOT_TAKEN', message: 'This spot is already assigned.' };

// Julie's session on her assigned A-1, not answered yet.
export function julieSessionIn(state: EntrySessionState): StoredAnsweringSession {
  return { driverId: julie.id, assignedSpotNumber: 'A-1', state, confirmedSpotNumber: null, answeredAt: null };
}

// Amélie's session, electric vehicle with a permit, on the assigned spot of her choice.
export function amelieSessionIn(state: EntrySessionState, assignedSpotNumber: string): StoredAnsweringSession {
  return { driverId: amelie.id, assignedSpotNumber, needs: electricWithPermitNeeds, state, confirmedSpotNumber: null, answeredAt: null };
}

// Parking Démo with the session under the id of Julie's and the spots the case needs; Julie, Marc and Amélie all accepted the notice.
export async function julieWithAnsweringSession(session: StoredAnsweringSession, spots: Readonly<Record<string, StoredSpot>>) {
  const configured = configureServer({ drivers: [julie, marc, amelie] });
  const { server, parkedAnswers, driverRepository } = configured;
  parkedAnswers.add(JULIE_SESSION_ID, session);
  Object.entries(spots).forEach(([number, spot]) => parkedAnswers.setSpot(number, spot));
  await acceptNoticeAs(driverRepository, julie);
  await acceptNoticeAs(driverRepository, marc);
  await acceptNoticeAs(driverRepository, amelie);
  const julieHeaders = await authorizationFor(driverRepository, julie);
  const answer = (spotNumber: unknown, headers: Record<string, string> = julieHeaders) =>
    server.inject({ method: 'POST', url: `/v1/entries/${JULIE_SESSION_ID}/spot`, headers, payload: { spotNumber } });
  const amelieHeaders = await authorizationFor(driverRepository, amelie);
  return { ...configured, answer, amelieHeaders };
}

import type { CurrentParkingSession } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { isInstant } from './isInstant';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { PalierUnreachableError } from './LotsClient';
import { isSpot } from './parseEntry';
import { parseBeaconMajor, parseLevelPlan } from './parseLevelPlan';

const ACTIVE_STATES: readonly unknown[] = ACTIVE_ENTRY_SESSION_STATES;

export function parseCurrentParkingSession(body: unknown): CurrentParkingSession | null {
  const session = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['session'] : undefined;
  if (session === null) {
    return null;
  }
  if (!isCurrentParkingSession(session)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  const { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents } = session;
  const guidance = { beaconMajor: parseBeaconMajor(session.beaconMajor), levelPlan: parseLevelPlan(session.levelPlan) };
  return { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents, ...guidance };
}

// beaconMajor and levelPlan are left out on purpose: an older API or a bad plan still gives the driver their session.
function isCurrentParkingSession(candidate: unknown): candidate is CurrentParkingSession {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents } = candidate as Record<string, unknown>;
  return (
    typeof sessionId === 'string' &&
    ACTIVE_STATES.includes(state) &&
    typeof lotName === 'string' &&
    isSpot(spot) &&
    isInstant(enteredAt) &&
    [elapsedMinutes, amountCents, dailyCapCents].every(isNonNegativeInteger)
  );
}

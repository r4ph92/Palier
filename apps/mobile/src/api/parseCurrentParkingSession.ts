import type { CurrentParkingSession } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { asRecord } from './asRecord';
import { isInstant } from './isInstant';
import { isNonNegativeInteger } from './isNonNegativeInteger';
import { PalierUnreachableError } from './LotsClient';
import { isSpot } from './parseEntry';
import { parseBeaconMajor, parseLevelPlan } from './parseLevelPlan';

const ACTIVE_STATES: readonly unknown[] = ACTIVE_ENTRY_SESSION_STATES;

// Everything the session needs; beaconMajor and levelPlan are read apart, so an older API or a bad plan still gives the driver their session.
type SessionCore = Omit<CurrentParkingSession, 'beaconMajor' | 'levelPlan'>;

export function parseCurrentParkingSession(body: unknown): CurrentParkingSession | null {
  const session = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['session'] : undefined;
  if (session === null) {
    return null;
  }
  if (!isSessionCore(session)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  const { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents } = session;
  const { beaconMajor, levelPlan } = asRecord(session);
  const guidance = { beaconMajor: parseBeaconMajor(beaconMajor), levelPlan: parseLevelPlan(levelPlan) };
  return { sessionId, state, lotName, spot, enteredAt, elapsedMinutes, amountCents, dailyCapCents, ...guidance };
}

function isSessionCore(candidate: unknown): candidate is SessionCore {
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

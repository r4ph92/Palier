import type { EntrySessionState, EntryStatusResponse } from '@palier/shared-types';
import { PalierUnreachableError } from './LotsClient';
import { isSpot } from './parseEntry';

const SESSION_STATES: readonly unknown[] = ['CREATED', 'ENTRY_CONFIRMED', 'CANCELLED'] satisfies EntrySessionState[];

export function parseEntryStatus(body: unknown): EntryStatusResponse {
  if (!isEntryStatus(body)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { sessionId: body.sessionId, state: body.state, spot: body.spot, entryConfirmedAt: body.entryConfirmedAt };
}

function isEntryStatus(candidate: unknown): candidate is EntryStatusResponse {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { sessionId, state, spot, entryConfirmedAt } = candidate as Record<string, unknown>;
  return (
    typeof sessionId === 'string' &&
    SESSION_STATES.includes(state) &&
    isSpot(spot) &&
    (entryConfirmedAt === null || typeof entryConfirmedAt === 'string')
  );
}

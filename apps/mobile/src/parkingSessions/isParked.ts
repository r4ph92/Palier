import type { EntrySessionState } from '@palier/shared-types';
import { PARKED_SESSION_STATES } from '@palier/shared-types/entries';

const PARKED_STATES: readonly EntrySessionState[] = PARKED_SESSION_STATES;

export function isParked(state: EntrySessionState): boolean {
  return PARKED_STATES.includes(state);
}

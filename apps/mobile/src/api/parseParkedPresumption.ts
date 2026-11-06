import type { ParkedPresumptionResponse, WalkedAwayState } from '@palier/shared-types';
import { isInstant } from './isInstant';
import { PalierUnreachableError } from './LotsClient';

const WALKED_AWAY_STATES: readonly unknown[] = ['PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'] satisfies WalkedAwayState[];

export function parseParkedPresumption(body: unknown): ParkedPresumptionResponse {
  const { state, parkedAt } = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!isWalkedAwayState(state) || !isInstant(parkedAt)) {
    throw new PalierUnreachableError('unexpected response body');
  }
  return { state, parkedAt };
}

function isWalkedAwayState(candidate: unknown): candidate is WalkedAwayState {
  return WALKED_AWAY_STATES.includes(candidate);
}

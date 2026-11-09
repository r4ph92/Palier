import type { SpotState } from '../spots/spotStates.ts';

export interface SpotOfExit {
  readonly id: string;
  readonly state: SpotState;
  // Another active session has it as its assigned or confirmed spot.
  readonly heldByAnotherSession: boolean;
}

// The spot the car stood in is free again whatever the sensors guessed. The other spots the session touched (the assigned one
// after a correction, every one the driver reported taken) come back only if they are still OCCUPIED_UNKNOWN and nobody else
// has them now; they stay flagged to check (decision 022, Q21). An operator's change since is not overwritten.
export function spotsFreedOnExit(ownSpotId: string, spots: readonly SpotOfExit[]): string[] {
  return spots.filter((spot) => (spot.id === ownSpotId ? isTaken(spot.state) : spot.state === 'OCCUPIED_UNKNOWN' && !spot.heldByAnotherSession)).map((spot) => spot.id);
}

function isTaken(state: SpotState): boolean {
  return state === 'OCCUPIED' || state === 'OCCUPIED_UNKNOWN';
}

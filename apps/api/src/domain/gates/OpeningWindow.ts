import { SECOND_MILLISECONDS } from '../time/seconds.ts';

// How long after the barrier opened a loop closure still confirms the entry; past it, the cancellation job may cancel it.
export interface OpeningWindow {
  readonly withinMilliseconds: number;
}

export function openingWindowOf(confirmationWindowSeconds: number): OpeningWindow {
  return { withinMilliseconds: confirmationWindowSeconds * SECOND_MILLISECONDS };
}

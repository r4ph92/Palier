// How long after the barrier opened a loop closure still confirms the entry; past it, the cancellation job may cancel it.
export interface OpeningWindow {
  readonly withinMilliseconds: number;
}

const SECOND_MILLISECONDS = 1000;

export function openingWindowOf(confirmationWindowSeconds: number): OpeningWindow {
  return { withinMilliseconds: confirmationWindowSeconds * SECOND_MILLISECONDS };
}

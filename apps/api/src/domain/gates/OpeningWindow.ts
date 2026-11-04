// How long after the barrier opened a loop closure still confirms the entry; past it, the cancellation job may cancel it.
export interface OpeningWindow {
  readonly withinMilliseconds: number;
}

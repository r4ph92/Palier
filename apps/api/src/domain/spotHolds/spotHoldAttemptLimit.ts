import { MILLISECONDS_PER_MINUTE } from '../time/durations.ts';

// Counts the attempts that reach the lot lock, so one driver token cannot keep a lot's lock busy.
export const SPOT_HOLD_ATTEMPT_LIMIT = 10;
export const SPOT_HOLD_ATTEMPT_WINDOW_MINUTES = 10;
export const SPOT_HOLD_ATTEMPT_WINDOW_MILLISECONDS = SPOT_HOLD_ATTEMPT_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE;

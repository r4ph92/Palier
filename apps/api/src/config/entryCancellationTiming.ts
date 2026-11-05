import { readPositiveWholeNumber } from './readPositiveWholeNumber.ts';

export interface EntryCancellationTiming {
  readonly confirmationWindowSeconds: number;
  readonly cancellationPeriodSeconds: number;
}

const DEFAULT_CONFIRMATION_WINDOW_SECONDS = 60;
const DEFAULT_CANCELLATION_PERIOD_SECONDS = 30;
// Above the app's 8 s entry timeout and the ~6 s card hold, so an entry still being admitted is never taken for an orphan.
const MINIMUM_CONFIRMATION_WINDOW_SECONDS = 30;
// The app polls an entry for 2 minutes: the cancellation must land before it stops, with a margin for the last poll.
const MAXIMUM_WINDOW_AND_PERIOD_SECONDS = 110;

export function readEntryCancellationTiming(variables: NodeJS.ProcessEnv): EntryCancellationTiming {
  const confirmationWindowSeconds = readSeconds('ENTRY_CONFIRMATION_WINDOW_SECONDS', variables, DEFAULT_CONFIRMATION_WINDOW_SECONDS);
  const cancellationPeriodSeconds = readSeconds('ENTRY_CANCELLATION_PERIOD_SECONDS', variables, DEFAULT_CANCELLATION_PERIOD_SECONDS);
  ensureWindowAboveFloor(confirmationWindowSeconds);
  ensurePeriodWithinWindow(cancellationPeriodSeconds, confirmationWindowSeconds);
  ensureCancellationBeforeAppStopsPolling(confirmationWindowSeconds + cancellationPeriodSeconds);
  return { confirmationWindowSeconds, cancellationPeriodSeconds };
}

function readSeconds(name: string, variables: NodeJS.ProcessEnv, defaultSeconds: number): number {
  const rawSeconds = variables[name];
  if (rawSeconds === undefined || rawSeconds === '') {
    return defaultSeconds;
  }
  const seconds = readPositiveWholeNumber(rawSeconds);
  if (seconds === null) {
    throw new Error(`${name} must be a positive whole number of seconds, got "${rawSeconds}".`);
  }
  return seconds;
}

function ensureWindowAboveFloor(windowSeconds: number): void {
  if (windowSeconds < MINIMUM_CONFIRMATION_WINDOW_SECONDS) {
    throw new Error(`ENTRY_CONFIRMATION_WINDOW_SECONDS must be at least ${MINIMUM_CONFIRMATION_WINDOW_SECONDS}, got ${windowSeconds}.`);
  }
}

function ensurePeriodWithinWindow(periodSeconds: number, windowSeconds: number): void {
  if (periodSeconds > windowSeconds) {
    throw new Error(`ENTRY_CANCELLATION_PERIOD_SECONDS must not exceed the confirmation window (${windowSeconds}), got ${periodSeconds}.`);
  }
}

function ensureCancellationBeforeAppStopsPolling(totalSeconds: number): void {
  if (totalSeconds > MAXIMUM_WINDOW_AND_PERIOD_SECONDS) {
    throw new Error(
      `ENTRY_CONFIRMATION_WINDOW_SECONDS plus ENTRY_CANCELLATION_PERIOD_SECONDS must not exceed ${MAXIMUM_WINDOW_AND_PERIOD_SECONDS}, got ${totalSeconds}.`,
    );
  }
}

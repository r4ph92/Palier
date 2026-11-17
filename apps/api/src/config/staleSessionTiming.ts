import { readSeconds } from './readSeconds.ts';

// Hourly, not daily: the flag is idempotent, so a restart or a missed run only delays a flag by an hour (decision 043).
const DEFAULT_STALE_SESSION_CHECK_SECONDS = 3600;

export function readStaleSessionCheckPeriodSeconds(variables: NodeJS.ProcessEnv): number {
  return readSeconds('STALE_SESSION_CHECK_SECONDS', variables, DEFAULT_STALE_SESSION_CHECK_SECONDS);
}

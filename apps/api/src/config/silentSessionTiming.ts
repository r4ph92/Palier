import { readSeconds } from './readSeconds.ts';

const DEFAULT_SILENT_SESSION_CHECK_PERIOD_SECONDS = 300;

export function readSilentSessionCheckPeriodSeconds(variables: NodeJS.ProcessEnv): number {
  return readSeconds('SILENT_SESSION_CHECK_PERIOD_SECONDS', variables, DEFAULT_SILENT_SESSION_CHECK_PERIOD_SECONDS);
}

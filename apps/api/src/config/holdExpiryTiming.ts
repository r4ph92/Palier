import { readSeconds } from './readSeconds.ts';

const DEFAULT_HOLD_EXPIRY_PERIOD_SECONDS = 30;

export function readHoldExpiryPeriodSeconds(variables: NodeJS.ProcessEnv): number {
  return readSeconds('HOLD_EXPIRY_PERIOD_SECONDS', variables, DEFAULT_HOLD_EXPIRY_PERIOD_SECONDS);
}

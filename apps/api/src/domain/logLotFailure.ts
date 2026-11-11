import { LotBusyError } from './lots/LotBusyError.ts';
import type { JobLog } from './JobLog.ts';

// A busy lot is routine and retried at the next check; any other failure keeps its error and stack.
export interface LotFailure {
  readonly lotId: string;
  readonly error: unknown;
}

export function logLotFailure(log: JobLog, { lotId, error }: LotFailure, failureMessage: string): void {
  if (error instanceof LotBusyError) {
    log.warn({ lotId }, 'lot busy, retried at the next check');
    return;
  }
  log.error({ err: error, lotId }, failureMessage);
}

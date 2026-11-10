import { SingleRun, type PeriodicTask } from './SingleRun.ts';

export const RETRY_CAPTURES_PERIOD_MILLISECONDS = 60_000;

// retry_captures (docs/02): every minute, so a pending capture is taken within two minutes of Stripe coming back.
export function startRetryCaptures(task: () => Promise<void>, logger: PeriodicTask['logger']): () => Promise<void> {
  return new SingleRun().startPeriodicTask(task, {
    logger,
    failureMessage: 'Retrying pending captures failed',
    periodMilliseconds: RETRY_CAPTURES_PERIOD_MILLISECONDS,
  });
}

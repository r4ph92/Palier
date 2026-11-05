import { logFailure, SingleRun, type JobLogger } from './SingleRun.ts';

export interface CancellationTasks {
  cancel(): Promise<void>;
  release(): Promise<void>;
}

interface Schedule {
  readonly cancelling: SingleRun;
  readonly releasing: SingleRun;
  isStopped: boolean;
}

// Cancel and release are guarded apart, so a release stuck on Stripe never delays the next cancellation, nor the stop.
export function startUnconfirmedEntryCancellation(
  tasks: CancellationTasks,
  logger: JobLogger,
  periodMilliseconds: number,
): () => Promise<void> {
  const schedule: Schedule = { cancelling: new SingleRun(), releasing: new SingleRun(), isStopped: false };
  const timer = setInterval(() => void check(schedule, tasks, logger), periodMilliseconds);
  return async () => {
    schedule.isStopped = true;
    clearInterval(timer);
    await schedule.cancelling.finished();
  };
}

async function check(schedule: Schedule, tasks: CancellationTasks, logger: JobLogger): Promise<void> {
  await schedule.cancelling.start(() => logFailure(tasks.cancel, logger, 'Cancelling unconfirmed entries failed'));
  if (!schedule.isStopped) {
    void schedule.releasing.start(() => logFailure(tasks.release, logger, 'Releasing card holds failed'));
  }
}

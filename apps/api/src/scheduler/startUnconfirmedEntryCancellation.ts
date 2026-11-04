export interface CancellationTasks {
  cancel(): Promise<void>;
  release(): Promise<void>;
}

export interface CancellationSchedulerLogger {
  error(details: { err: unknown }, message: string): void;
}

// A task still running when the next period comes is skipped, never stacked.
class SingleRun {
  #running: Promise<void> | null = null;

  start(task: () => Promise<void>): Promise<void> {
    if (this.#running !== null) {
      return Promise.resolve();
    }
    const running = task().finally(() => {
      this.#running = null;
    });
    this.#running = running;
    return running;
  }

  finished(): Promise<void> {
    return this.#running ?? Promise.resolve();
  }
}

interface Schedule {
  readonly cancelling: SingleRun;
  readonly releasing: SingleRun;
  isStopped: boolean;
}

// Cancel and release are guarded apart, so a release stuck on Stripe never delays the next cancellation, nor the stop.
export function startUnconfirmedEntryCancellation(
  tasks: CancellationTasks,
  logger: CancellationSchedulerLogger,
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

async function check(schedule: Schedule, tasks: CancellationTasks, logger: CancellationSchedulerLogger): Promise<void> {
  await schedule.cancelling.start(() => logFailure(tasks.cancel, logger, 'Cancelling unconfirmed entries failed'));
  if (!schedule.isStopped) {
    void schedule.releasing.start(() => logFailure(tasks.release, logger, 'Releasing card holds failed'));
  }
}

async function logFailure(task: () => Promise<void>, logger: CancellationSchedulerLogger, message: string): Promise<void> {
  try {
    await task();
  } catch (error) {
    logger.error({ err: error }, message);
  }
}

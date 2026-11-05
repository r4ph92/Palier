
export interface JobLogger {
  error(details: { err: unknown }, message: string): void;
}

export interface PeriodicTask {
  readonly logger: JobLogger;
  readonly failureMessage: string;
  readonly periodMilliseconds: number;
}

// A task still running when the next period comes is skipped, never stacked.
export class SingleRun {
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

  // A failed run is logged and the next period still runs. The returned function stops the timer and awaits the run in flight.
  startPeriodicTask(task: () => Promise<void>, { logger, failureMessage, periodMilliseconds }: PeriodicTask): () => Promise<void> {
    const timer = setInterval(() => void this.start(() => logFailure(task, logger, failureMessage)), periodMilliseconds);
    return async () => {
      clearInterval(timer);
      await this.finished();
    };
  }
}

export async function logFailure(task: () => Promise<void>, logger: JobLogger, message: string): Promise<void> {
  try {
    await task();
  } catch (error) {
    logger.error({ err: error }, message);
  }
}

export async function stopAll(stops: readonly (() => Promise<void>)[]): Promise<void> {
  await Promise.all(stops.map((stop) => stop()));
}

import { SingleRun } from './SingleRun.ts';

export interface HoldExpirySchedulerLogger {
  error(details: { err: unknown }, message: string): void;
}

// A failed run is logged and the next period still runs. The returned function stops the timer and awaits the run in flight.
export function startHoldExpiry(expire: () => Promise<void>, logger: HoldExpirySchedulerLogger, periodMilliseconds: number): () => Promise<void> {
  const singleRun = new SingleRun();
  const timer = setInterval(() => void singleRun.start(() => runExpiry(expire, logger)), periodMilliseconds);
  return async () => {
    clearInterval(timer);
    await singleRun.finished();
  };
}

async function runExpiry(expire: () => Promise<void>, logger: HoldExpirySchedulerLogger): Promise<void> {
  try {
    await expire();
  } catch (error) {
    logger.error({ err: error }, 'Expiring spot holds failed');
  }
}

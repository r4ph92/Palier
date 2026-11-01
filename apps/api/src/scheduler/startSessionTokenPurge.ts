const HOUR_MILLISECONDS = 60 * 60 * 1000;

export interface PurgeLogger {
  info(details: { purged: number }, message: string): void;
  error(details: { err: unknown }, message: string): void;
}

// Runs the purge every hour and logs how many tokens it removed. A failed run is logged and the next one still happens.
// The returned function stops the timer and resolves once the purge in flight, if any, has finished.
export function startSessionTokenPurge(
  purge: () => Promise<number>,
  logger: PurgeLogger,
  intervalMilliseconds = HOUR_MILLISECONDS,
): () => Promise<void> {
  let inFlight: Promise<void> = Promise.resolve();
  const timer = setInterval(() => {
    inFlight = runPurge(purge, logger);
  }, intervalMilliseconds);
  return async () => {
    clearInterval(timer);
    await inFlight;
  };
}

async function runPurge(purge: () => Promise<number>, logger: PurgeLogger): Promise<void> {
  try {
    logger.info({ purged: await purge() }, 'Purged ended session tokens');
  } catch (error) {
    logger.error({ err: error }, 'Purging ended session tokens failed');
  }
}

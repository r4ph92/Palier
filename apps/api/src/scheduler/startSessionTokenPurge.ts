const HOUR_MILLISECONDS = 60 * 60 * 1000;

export interface PurgeLogger {
  info(details: { purged: number }, message: string): void;
  error(details: { err: unknown }, message: string): void;
}

// Runs the purge every hour and logs how many tokens it removed. A failed run is logged and the next one still happens.
export function startSessionTokenPurge(
  purge: () => Promise<number>,
  logger: PurgeLogger,
  intervalMilliseconds = HOUR_MILLISECONDS,
): () => void {
  const timer = setInterval(() => void runPurge(purge, logger), intervalMilliseconds);
  return () => clearInterval(timer);
}

async function runPurge(purge: () => Promise<number>, logger: PurgeLogger): Promise<void> {
  try {
    logger.info({ purged: await purge() }, 'Purged ended session tokens');
  } catch (error) {
    logger.error({ err: error }, 'Purging ended session tokens failed');
  }
}

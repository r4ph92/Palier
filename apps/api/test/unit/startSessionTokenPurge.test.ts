import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSessionTokenPurge } from '../../src/scheduler/startSessionTokenPurge.ts';

const HOUR = 60 * 60 * 1000;

describe('session token purge schedule', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('purges every hour and logs how many tokens it removed', async () => {
    const purge = vi.fn(() => Promise.resolve(2));
    const logger = { info: vi.fn(), error: vi.fn() };
    const stop = startSessionTokenPurge(purge, logger);

    await vi.advanceTimersByTimeAsync(HOUR);

    expect(purge).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({ purged: 2 }, 'Purged ended session tokens');
    stop();
  });

  it('stops purging once stopped', async () => {
    const purge = vi.fn(() => Promise.resolve(0));
    const stop = startSessionTokenPurge(purge, { info: vi.fn(), error: vi.fn() });

    stop();
    await vi.advanceTimersByTimeAsync(3 * HOUR);

    expect(purge).not.toHaveBeenCalled();
  });

  it('logs a failed purge and still purges on the next hour', async () => {
    const purge = vi.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValueOnce(1);
    const logger = { info: vi.fn(), error: vi.fn() };
    const stop = startSessionTokenPurge(purge, logger);

    await vi.advanceTimersByTimeAsync(2 * HOUR);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({ purged: 1 }, 'Purged ended session tokens');
    stop();
  });
});

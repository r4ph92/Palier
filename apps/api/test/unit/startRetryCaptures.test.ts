import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRetryCaptures } from '../../src/scheduler/startRetryCaptures.ts';

const MINUTE = 60 * 1000;

describe('retry_captures schedule', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs every minute', async () => {
    const task = vi.fn(() => Promise.resolve());
    const stop = startRetryCaptures(task, { error: vi.fn() });

    await vi.advanceTimersByTimeAsync(3 * MINUTE);

    expect(task).toHaveBeenCalledTimes(3);
    await stop();
  });

  it('logs a failed run and still runs the next minute', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(undefined);
    const logger = { error: vi.fn() };
    const stop = startRetryCaptures(task, logger);

    await vi.advanceTimersByTimeAsync(2 * MINUTE);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('skips a run while the previous one is still going', async () => {
    let finish = () => {};
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = startRetryCaptures(task, { error: vi.fn() });

    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(task).toHaveBeenCalledTimes(1);

    finish();
    await stop();
  });

  it('stops running once stopped', async () => {
    const task = vi.fn(() => Promise.resolve());
    const stop = startRetryCaptures(task, { error: vi.fn() });

    await stop();
    await vi.advanceTimersByTimeAsync(3 * MINUTE);

    expect(task).not.toHaveBeenCalled();
  });
});

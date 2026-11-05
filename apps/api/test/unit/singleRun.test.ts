import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SingleRun, stopAll } from '../../src/scheduler/SingleRun.ts';

const PERIOD = 30_000;

function periodic(expire: () => Promise<void>, logger = { error: vi.fn() }) {
  return new SingleRun().startPeriodicTask(expire, { logger, failureMessage: 'Task failed', periodMilliseconds: PERIOD });
}

describe('periodic task', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs at each period', async () => {
    const expire = vi.fn(() => Promise.resolve());
    const stop = periodic(expire);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(expire).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('skips a period while the previous run still works', async () => {
    let finish: () => void = () => undefined;
    const expire = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = periodic(expire);

    await vi.advanceTimersByTimeAsync(3 * PERIOD);
    expect(expire).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(PERIOD);
    expect(expire).toHaveBeenCalledTimes(2);
    finish();
    await stop();
  });

  it('logs a failed run with the failure message and still runs at the next period', async () => {
    const failure = new Error('database down');
    const expire = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const logger = { error: vi.fn() };
    const stop = periodic(expire, logger);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ err: failure }, 'Task failed');
    expect(expire).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('waits for the run in flight, then never runs again', async () => {
    let finish: () => void = () => undefined;
    const expire = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = periodic(expire);
    await vi.advanceTimersByTimeAsync(PERIOD);
    let stopped = false;

    const stopping = stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    finish();
    await stopping;
    await vi.advanceTimersByTimeAsync(3 * PERIOD);

    expect(expire).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('stopAll', () => {
  it('waits for every stop, not only the first', async () => {
    const finished: string[] = [];
    const slowStop = (name: string) => () => new Promise<void>((resolve) => setTimeout(() => resolve(void finished.push(name)), 5));

    await stopAll([slowStop('expiry'), slowStop('cancellation'), slowStop('purge')]);

    expect(finished.sort()).toEqual(['cancellation', 'expiry', 'purge']);
  });
});

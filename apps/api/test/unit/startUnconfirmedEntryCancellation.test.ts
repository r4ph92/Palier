import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startUnconfirmedEntryCancellation } from '../../src/scheduler/startUnconfirmedEntryCancellation.ts';

const PERIOD = 30_000;

function never(): Promise<void> {
  return new Promise(() => undefined);
}

describe('unconfirmed entry cancellation schedule', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels, then releases holds, at each period', async () => {
    const order: string[] = [];
    const tasks = { cancel: vi.fn(async () => void order.push('cancel')), release: vi.fn(async () => void order.push('release')) };
    const stop = startUnconfirmedEntryCancellation(tasks, { error: vi.fn() }, PERIOD);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(order).toEqual(['cancel', 'release', 'cancel', 'release']);
    await stop();
  });

  it('keeps cancelling while a release hangs on Stripe, without stacking releases', async () => {
    const tasks = { cancel: vi.fn(() => Promise.resolve()), release: vi.fn(never) };
    const stop = startUnconfirmedEntryCancellation(tasks, { error: vi.fn() }, PERIOD);

    await vi.advanceTimersByTimeAsync(3 * PERIOD);

    expect(tasks.cancel).toHaveBeenCalledTimes(3);
    expect(tasks.release).toHaveBeenCalledTimes(1);
    await stop();
  });

  it('skips a period while the previous cancellation still runs', async () => {
    let finishCancel: () => void = () => undefined;
    const tasks = {
      cancel: vi.fn(() => new Promise<void>((resolve) => (finishCancel = resolve))),
      release: vi.fn(() => Promise.resolve()),
    };
    const stop = startUnconfirmedEntryCancellation(tasks, { error: vi.fn() }, PERIOD);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);
    expect(tasks.cancel).toHaveBeenCalledTimes(1);
    expect(tasks.release).toHaveBeenCalledTimes(1);

    finishCancel();
    await vi.advanceTimersByTimeAsync(PERIOD);
    expect(tasks.cancel).toHaveBeenCalledTimes(2);
    finishCancel();
    await stop();
  });

  it('logs a failed check and still checks at the next period', async () => {
    const logger = { error: vi.fn() };
    const tasks = { cancel: vi.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(undefined), release: vi.fn(() => Promise.resolve()) };
    const stop = startUnconfirmedEntryCancellation(tasks, logger, PERIOD);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(logger.error).toHaveBeenCalledWith({ err: new Error('database down') }, 'Cancelling unconfirmed entries failed');
    expect(tasks.cancel).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('stops checking once stopped, and waits for the cancellation but not for a hanging release', async () => {
    const tasks = { cancel: vi.fn(() => Promise.resolve()), release: vi.fn(never) };
    const stop = startUnconfirmedEntryCancellation(tasks, { error: vi.fn() }, PERIOD);
    await vi.advanceTimersByTimeAsync(PERIOD);

    await stop();
    await vi.advanceTimersByTimeAsync(3 * PERIOD);

    expect(tasks.cancel).toHaveBeenCalledTimes(1);
  });

  it('starts no release after being stopped during a cancellation', async () => {
    let finishCancel: () => void = () => undefined;
    const tasks = { cancel: vi.fn(() => new Promise<void>((resolve) => (finishCancel = resolve))), release: vi.fn(() => Promise.resolve()) };
    const stop = startUnconfirmedEntryCancellation(tasks, { error: vi.fn() }, PERIOD);
    await vi.advanceTimersByTimeAsync(PERIOD);

    const stopped = stop();
    finishCancel();
    await stopped;
    await vi.advanceTimersByTimeAsync(0);

    expect(tasks.release).not.toHaveBeenCalled();
  });
});

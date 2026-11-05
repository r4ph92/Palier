import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHoldExpiry } from '../../src/scheduler/startHoldExpiry.ts';

const PERIOD = 30_000;

describe('hold expiry schedule', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('expires at each period', async () => {
    const expire = vi.fn(() => Promise.resolve());
    const stop = startHoldExpiry(expire, { error: vi.fn() }, PERIOD);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(expire).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('skips a period while the previous run still works', async () => {
    let finish: () => void = () => undefined;
    const expire = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = startHoldExpiry(expire, { error: vi.fn() }, PERIOD);

    await vi.advanceTimersByTimeAsync(3 * PERIOD);
    expect(expire).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(PERIOD);
    expect(expire).toHaveBeenCalledTimes(2);
    finish();
    await stop();
  });

  it('logs a failed run and still runs at the next period', async () => {
    const failure = new Error('database down');
    const expire = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const logger = { error: vi.fn() };
    const stop = startHoldExpiry(expire, logger, PERIOD);

    await vi.advanceTimersByTimeAsync(2 * PERIOD);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ err: failure }, 'Expiring spot holds failed');
    expect(expire).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('stops the timer and waits for the run in flight', async () => {
    let finish: () => void = () => undefined;
    const expire = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = startHoldExpiry(expire, { error: vi.fn() }, PERIOD);
    await vi.advanceTimersByTimeAsync(PERIOD);
    let stopped = false;

    const stopping = stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(3 * PERIOD);
    expect(stopped).toBe(false);
    finish();
    await stopping;

    expect(expire).toHaveBeenCalledTimes(1);
  });
});

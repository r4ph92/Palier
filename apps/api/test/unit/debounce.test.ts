import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounced } from '../../src/http/demo/debounce.js';

describe('debounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the action once after the calls pause, not once per keystroke', () => {
    const action = vi.fn();
    const afterPause = debounced(action, 400);

    afterPause();
    vi.advanceTimersByTime(300);
    afterPause();
    vi.advanceTimersByTime(300);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs again for a later burst', () => {
    const action = vi.fn();
    const afterPause = debounced(action, 400);

    afterPause();
    vi.advanceTimersByTime(400);
    afterPause();
    vi.advanceTimersByTime(400);

    expect(action).toHaveBeenCalledTimes(2);
  });
});

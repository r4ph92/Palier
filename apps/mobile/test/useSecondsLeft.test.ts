import { act, renderHook } from '@testing-library/react-native';
import { heldSpotFrom } from '../src/spotHolds/heldSpot';
import { useSecondsLeft } from '../src/spotHolds/useSecondsLeft';
import { julieHoldAtParkingDemo } from './fakeSpotHoldClient';

const ONE_SECOND = 1000;
const FIFTEEN_MINUTES = 15 * 60 * ONE_SECOND;

// Other parts of the test renderer run timers too, so the countdown's own intervals are followed by their ids.
async function renderCountdown() {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  const held = heldSpotFrom(julieHoldAtParkingDemo(), Date.now(), true);
  const rendered = await renderHook(() => useSecondsLeft(held));
  const countdownTimers = () => setIntervalSpy.mock.results.filter((_result, index) => setIntervalSpy.mock.calls[index]?.[1] === ONE_SECOND).map(({ value }) => value);
  const clearedTimers = () => clearIntervalSpy.mock.calls.map(([timer]) => timer);
  const isCleared = () => countdownTimers().every((timer) => clearedTimers().includes(timer));
  return { ...rendered, countdownTimers, isCleared };
}

describe('useSecondsLeft', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('ticks every second while time is left', async () => {
    const { result, countdownTimers, isCleared } = await renderCountdown();

    await act(() => jest.advanceTimersByTimeAsync(2 * ONE_SECOND));

    expect(result.current).toBe(898);
    expect(countdownTimers()).toHaveLength(1);
    expect(isCleared()).toBe(false);
  });

  it('stops its timer once the countdown reaches 0', async () => {
    const { result, isCleared } = await renderCountdown();

    await act(() => jest.advanceTimersByTimeAsync(FIFTEEN_MINUTES));

    expect(result.current).toBe(0);
    expect(isCleared()).toBe(true);
  });

  it('stops its timer when the banner leaves the screen', async () => {
    const { unmount, isCleared } = await renderCountdown();

    await act(async () => unmount());

    expect(isCleared()).toBe(true);
  });
});

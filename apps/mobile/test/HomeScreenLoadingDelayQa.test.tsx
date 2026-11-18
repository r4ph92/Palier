import { act, screen, userEvent } from '@testing-library/react-native';
import type { LotListResponse } from '@palier/shared-types';
import { PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';
import { PLACEHOLDER_DELAY_MILLISECONDS } from '../src/components/LotListLoading';
import { parkingDemoWith } from './fakeLotsClient';
import { findFreeSpotCount, getFreeSpotCount } from './freeSpotCountQueries';
import { renderHomeScreen } from './renderHomeScreen';

type TimedAnswer = { readonly afterMilliseconds: number; readonly answer: LotListResponse | 'unreachable' };

// Each read answers on the fake clock, after its own delay.
class TimedLotsClient implements LotsClient {
  readonly #answers: readonly TimedAnswer[];
  callCount = 0;

  constructor(...answers: TimedAnswer[]) {
    this.#answers = answers;
  }

  listLots(): Promise<LotListResponse> {
    const timed = this.#answers[Math.min(this.callCount, this.#answers.length - 1)];
    this.callCount += 1;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (timed === undefined || timed.answer === 'unreachable') {
          reject(new PalierUnreachableError('fake'));
          return;
        }
        resolve(timed.answer);
      }, timed?.afterMilliseconds ?? 0);
    });
  }
}

class SilentLotsClient implements LotsClient {
  listLots(): Promise<LotListResponse> {
    return new Promise(() => undefined);
  }
}

async function advanceOneMillisecondAtATime(milliseconds: number): Promise<number> {
  let mostPlaceholdersSeen = 0;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1) {
    await act(() => jest.advanceTimersByTimeAsync(1));
    mostPlaceholdersSeen = Math.max(mostPlaceholdersSeen, screen.queryAllByTestId('lot-placeholder').length);
  }
  return mostPlaceholdersSeen;
}

describe('HomeScreen loading placeholders, at the edges of the delay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('never renders a placeholder, not for one millisecond, when the answer comes 1 ms before the delay', async () => {
    await renderHomeScreen(new TimedLotsClient({ afterMilliseconds: PLACEHOLDER_DELAY_MILLISECONDS - 1, answer: parkingDemoWith(10) }));

    const mostPlaceholdersSeen = await advanceOneMillisecondAtATime(PLACEHOLDER_DELAY_MILLISECONDS + 50);

    expect(mostPlaceholdersSeen).toBe(0);
    expect(getFreeSpotCount('10 places libres')).toBeOnTheScreen();
  });

  it('replaces the placeholders with the list when the answer comes just after the delay', async () => {
    await renderHomeScreen(new TimedLotsClient({ afterMilliseconds: PLACEHOLDER_DELAY_MILLISECONDS + 1, answer: parkingDemoWith(10) }));

    await act(() => jest.advanceTimersByTimeAsync(PLACEHOLDER_DELAY_MILLISECONDS));
    expect(screen.getAllByTestId('lot-placeholder')).toHaveLength(3);
    await act(() => jest.advanceTimersByTimeAsync(1));

    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
    expect(getFreeSpotCount('10 places libres')).toBeOnTheScreen();
  });

  it('keeps the list and shows no placeholder while a slow refresh is in flight', async () => {
    await renderHomeScreen(new TimedLotsClient({ afterMilliseconds: 0, answer: parkingDemoWith(10) }, { afterMilliseconds: 5000, answer: parkingDemoWith(9) }));
    await findFreeSpotCount('10 places libres');

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }).press(screen.getByRole('button', { name: 'Actualiser' }));
    await act(() => jest.advanceTimersByTimeAsync(2000));

    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
    expect(getFreeSpotCount('10 places libres')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(3000));
    expect(getFreeSpotCount('9 places libres')).toBeOnTheScreen();
  });

  it('keeps the error and shows no placeholder while a slow refresh from the error screen is in flight', async () => {
    await renderHomeScreen(new TimedLotsClient({ afterMilliseconds: 0, answer: 'unreachable' }, { afterMilliseconds: 5000, answer: parkingDemoWith(9) }));
    await screen.findByText('Impossible de joindre Palier.');

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }).press(screen.getByRole('button', { name: 'Actualiser' }));
    await act(() => jest.advanceTimersByTimeAsync(2000));

    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
    expect(screen.getByText('Impossible de joindre Palier.')).toBeOnTheScreen();
  });

  it('shows no placeholder when a retry from the error screen answers before the delay', async () => {
    await renderHomeScreen(new TimedLotsClient({ afterMilliseconds: 0, answer: 'unreachable' }, { afterMilliseconds: PLACEHOLDER_DELAY_MILLISECONDS - 1, answer: parkingDemoWith(9) }));
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }).press(await screen.findByRole('button', { name: 'Réessayer' }));

    const mostPlaceholdersSeen = await advanceOneMillisecondAtATime(PLACEHOLDER_DELAY_MILLISECONDS + 10);

    expect(mostPlaceholdersSeen).toBe(0);
    expect(getFreeSpotCount('9 places libres')).toBeOnTheScreen();
  });

  it('leaves no timer behind and logs no error when the screen goes away during the delay', async () => {
    const consoleError = jest.spyOn(console, 'error');
    const { unmount } = await renderHomeScreen(new SilentLotsClient());
    await act(() => jest.advanceTimersByTimeAsync(PLACEHOLDER_DELAY_MILLISECONDS / 2));

    await unmount();
    await act(() => jest.advanceTimersByTimeAsync(PLACEHOLDER_DELAY_MILLISECONDS));

    expect(jest.getTimerCount()).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

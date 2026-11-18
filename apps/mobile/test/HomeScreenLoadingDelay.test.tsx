import { act, screen, userEvent } from '@testing-library/react-native';
import type { LotListResponse } from '@palier/shared-types';
import { PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';
import { PLACEHOLDER_DELAY_MILLISECONDS } from '../src/components/LotListLoading';
import { parkingDemo } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

class DeferredLotsClient implements LotsClient {
  readonly #resolvers: Array<() => void> = [];
  readonly #failFirstRead: boolean;

  constructor(failFirstRead = false) {
    this.#failFirstRead = failFirstRead;
  }

  listLots(): Promise<LotListResponse> {
    if (this.#failFirstRead && this.#resolvers.length === 0) {
      this.#resolvers.push(() => undefined);
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    return new Promise((resolve) => {
      this.#resolvers.push(() => resolve([parkingDemo(10)]));
    });
  }

  answerOldestRead(): void {
    this.#resolvers.shift()?.();
  }
}

describe('HomeScreen loading placeholders', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('never shows placeholders when the API answers before the delay', async () => {
    const client = new DeferredLotsClient();
    await renderHomeScreen(client);

    await act(() => jest.advanceTimersByTime(PLACEHOLDER_DELAY_MILLISECONDS - 50));
    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
    expect(screen.getByLabelText('Chargement des stationnements')).toBeOnTheScreen();
    await act(() => client.answerOldestRead());

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(PLACEHOLDER_DELAY_MILLISECONDS));
    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
  });

  it('shows placeholders once the delay passes with no answer', async () => {
    await renderHomeScreen(new DeferredLotsClient());

    await act(() => jest.advanceTimersByTime(PLACEHOLDER_DELAY_MILLISECONDS));

    expect(screen.getAllByTestId('lot-placeholder')).toHaveLength(3);
  });

  it('waits the delay again when the driver retries after an error', async () => {
    await renderHomeScreen(new DeferredLotsClient(true));
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(screen.queryAllByTestId('lot-placeholder')).toHaveLength(0);
    await act(() => jest.advanceTimersByTime(PLACEHOLDER_DELAY_MILLISECONDS));

    expect(screen.getAllByTestId('lot-placeholder')).toHaveLength(3);
  });
});

import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { findFreeSpotCount } from './freeSpotCountQueries';
import { renderHomeScreen } from './renderHomeScreen';

const UNREACHABLE_FR = 'Impossible de joindre Palier.';
const UNREACHABLE_EN = 'Can’t reach Palier.';
const THIRTY_SECONDS = 30_000;

function announcementsOf(announce: jest.SpyInstance, message: string): number {
  return announce.mock.calls.filter(([announced]) => announced === message).length;
}

describe('HomeScreen error announcements', () => {
  let announce: jest.SpyInstance;

  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
  });
  afterEach(() => {
    announce.mockRestore();
    jest.useRealTimers();
  });

  it('announces the first error exactly once', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'));
    await screen.findByText(UNREACHABLE_FR);

    expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(1);
  });

  it('announces the error again for each pull to refresh that misses from the error screen', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'));
    await screen.findByText(UNREACHABLE_FR);

    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));
    await waitFor(() => expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(2));
    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    await waitFor(() => expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(3));
  });

  it('announces the error again when a retry misses', async () => {
    const client = new FakeLotsClient('unreachable');
    await renderHomeScreen(client);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(client.callCount).toBe(2));
    await waitFor(() => expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(2));
  });

  it('announces the error once when a refresh from a loaded list misses', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10), 'unreachable'));
    await findFreeSpotCount('10 places libres');

    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText(UNREACHABLE_FR)).toBeOnTheScreen();
    expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(1);
  });

  it('does not announce the error again when the 30-second poll misses on the error screen', async () => {
    jest.useFakeTimers();
    const client = new FakeLotsClient('unreachable');
    await renderHomeScreen(client);
    await screen.findByText(UNREACHABLE_FR);

    await act(() => jest.advanceTimersByTimeAsync(THIRTY_SECONDS));
    await act(() => jest.advanceTimersByTimeAsync(THIRTY_SECONDS));

    expect(client.callCount).toBe(3);
    expect(announcementsOf(announce, UNREACHABLE_FR)).toBe(1);
  });

  it('announces a repeated error again in English', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'), 'en');
    await screen.findByText(UNREACHABLE_EN);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(announcementsOf(announce, UNREACHABLE_EN)).toBe(2));
  });
});

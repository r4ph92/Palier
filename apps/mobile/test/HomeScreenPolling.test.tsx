import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeDeviceLocationClient, LOCATION_DENIED_NOTICE_FR } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';
import { visibleText } from './visibleText';

const THIRTY_SECONDS = 30_000;

async function waitForRefresh(): Promise<void> {
  await act(() => jest.advanceTimersByTimeAsync(THIRTY_SECONDS));
}

describe('HomeScreen automatic refresh', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows Complet 30 seconds after Parking Démo fills up', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0)));
    expect(await screen.findByText('2 places libres', visibleText)).toBeOnTheScreen();

    await waitForRefresh();

    expect(await screen.findByText('Complet')).toBeOnTheScreen();
  });

  it('keeps the last list and its time when a refresh misses', async () => {
    jest.setSystemTime(new Date(2026, 10, 4, 13, 25));
    const client = new FakeLotsClient(parkingDemoWith(2), 'unreachable');
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);
    jest.setSystemTime(new Date(2026, 10, 4, 13, 26));

    await waitForRefresh();

    expect(client.callCount).toBe(2);
    expect(screen.getByText('2 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Mis à jour à 13 h 25', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de joindre Palier.')).not.toBeOnTheScreen();
  });

  it('reuses the position it already has', async () => {
    const locationClient = new FakeDeviceLocationClient();
    const client = new FakeLotsClient(parkingDemoWith(2));
    await renderHomeScreen(client, 'fr', locationClient);
    await screen.findByText('2 places libres', visibleText);

    await waitForRefresh();

    expect(client.callCount).toBe(2);
    expect(locationClient.permissionRequests).toBe(1);
    expect(locationClient.positionReads).toBe(1);
  });

  it('does not announce the location notice again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(2)), 'fr', new FakeDeviceLocationClient('denied'));
    await screen.findByText(LOCATION_DENIED_NOTICE_FR);

    await waitForRefresh();

    expect(announce).toHaveBeenCalledTimes(1);
    announce.mockRestore();
  });

  it('polls first 30 seconds after the list shows, not after the screen opens', async () => {
    const locationClient = new FakeDeviceLocationClient('pending');
    const client = new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0));
    await renderHomeScreen(client, 'fr', locationClient);
    await act(() => jest.advanceTimersByTimeAsync(20_000));
    await act(async () => locationClient.answerPrompt('granted'));
    await screen.findByText('2 places libres', visibleText);

    await act(() => jest.advanceTimersByTimeAsync(THIRTY_SECONDS - 1));
    expect(client.callCount).toBe(1);
    await act(() => jest.advanceTimersByTimeAsync(1));

    expect(client.callCount).toBe(2);
  });

  it('stops once the screen is gone', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2));
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);

    await act(() => screen.unmount());
    await waitForRefresh();

    expect(client.callCount).toBe(1);
  });

  it('never reads the lots while the location prompt is still open', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2));
    await renderHomeScreen(client, 'fr', new FakeDeviceLocationClient('pending'));

    await waitForRefresh();

    expect(client.callCount).toBe(0);
    expect(screen.getByLabelText('Chargement des stationnements')).toBeOnTheScreen();
  });
});

describe('HomeScreen pull to refresh', () => {
  it('asks for the position again before reading the lots', async () => {
    const locationClient = new FakeDeviceLocationClient();
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0)), 'fr', locationClient);
    await screen.findByText('2 places libres', visibleText);

    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    expect(await screen.findByText('Complet')).toBeOnTheScreen();
    expect(locationClient.permissionRequests).toBe(2);
  });
});

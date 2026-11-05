import type { GeoPosition, LotListResponse } from '@palier/shared-types';
import { act, screen, userEvent } from '@testing-library/react-native';
import type { LotsClient } from '../src/api/LotsClient';
import type { DeviceLocationClient, LocationPermission } from '../src/deviceLocation/DeviceLocationClient';
import { LOTS_REFRESH_MILLISECONDS } from '../src/lots/useLots';
import { SIMULATOR_POSITION } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';
import { visibleText } from './visibleText';

async function waitForRefresh(): Promise<void> {
  await act(() => jest.advanceTimersByTimeAsync(LOTS_REFRESH_MILLISECONDS));
}

class ScriptedLocationClient implements DeviceLocationClient {
  permissionRequests = 0;

  requestWhileInUse(): Promise<LocationPermission> {
    this.permissionRequests += 1;
    return Promise.resolve('granted');
  }

  currentPosition(): Promise<GeoPosition | null> {
    return Promise.resolve(SIMULATOR_POSITION);
  }
}

describe('QA #5 automatic refresh abuse', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows Complet after 30 seconds, then the count again after 30 more when a spot frees up', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0), parkingDemoWith(1));
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);

    await waitForRefresh();
    expect(await screen.findByText('Complet')).toBeOnTheScreen();
    expect(screen.queryByText(/^Standard/, visibleText)).not.toBeOnTheScreen();
    await waitForRefresh();

    expect(await screen.findByText('1 place libre', visibleText)).toBeOnTheScreen();
    expect(client.callCount).toBe(3);
  });

  it('does not refresh before 30 seconds', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0));
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);

    await act(() => jest.advanceTimersByTimeAsync(LOTS_REFRESH_MILLISECONDS - 1));

    expect(client.callCount).toBe(1);
    expect(screen.queryByText('Complet')).not.toBeOnTheScreen();
  });

  it('keeps polling after a missed poll and shows the new list when the API is back', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2), 'unreachable', parkingDemoWith(0));
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);

    await waitForRefresh();
    expect(screen.getByText('2 places libres', visibleText)).toBeOnTheScreen();
    await waitForRefresh();

    expect(await screen.findByText('Complet')).toBeOnTheScreen();
  });

  it('recovers by itself from the first read failing', async () => {
    const client = new FakeLotsClient('unreachable', parkingDemoWith(2));
    await renderHomeScreen(client);
    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();

    await waitForRefresh();

    expect(await screen.findByText('2 places libres', visibleText)).toBeOnTheScreen();
  });

  it('shows the list without the pull-to-refresh spinner during a poll', async () => {
    const client = new FakeLotsClient(parkingDemoWith(2), parkingDemoWith(0));
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);

    await waitForRefresh();

    expect(screen.getByTestId('lot-list').props.refreshControl.props.refreshing).toBe(false);
  });

  it('does not ask for the permission again on any poll over several minutes', async () => {
    const location = new ScriptedLocationClient();
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(2)), 'fr', location);
    await screen.findByText('2 places libres', visibleText);

    for (let minute = 0; minute < 10; minute += 1) {
      await waitForRefresh();
    }

    expect(location.permissionRequests).toBe(1);
  });

  it('does not touch the screen when the screen goes away while a poll is in flight', async () => {
    let release: (lots: LotListResponse) => void = () => undefined;
    let calls = 0;
    const client: LotsClient = {
      listLots: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(parkingDemoWith(2)) : new Promise<LotListResponse>((resolve) => (release = resolve));
      },
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);
    await waitForRefresh();

    await act(() => screen.unmount());
    await act(async () => release(parkingDemoWith(0)));
    await waitForRefresh();

    expect(calls).toBe(2);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('discards a slow poll answer that comes back after a pull to refresh gave a newer list', async () => {
    const resolvers: ((lots: LotListResponse) => void)[] = [];
    let calls = 0;
    const client: LotsClient = {
      listLots: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(parkingDemoWith(2)) : new Promise<LotListResponse>((resolve) => resolvers.push(resolve));
      },
    };
    await renderHomeScreen(client);
    await screen.findByText('2 places libres', visibleText);
    await waitForRefresh();
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole('button', { name: 'Actualiser' }));

    await act(async () => resolvers[1]?.(parkingDemoWith(5)));
    await act(async () => resolvers[0]?.(parkingDemoWith(0)));

    expect(screen.getByText('5 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Complet')).not.toBeOnTheScreen();
  });

  it('unmounting while the permission prompt is open never reads the lots afterwards', async () => {
    let answer: (permission: LocationPermission) => void = () => undefined;
    const location: DeviceLocationClient = {
      requestWhileInUse: () => new Promise<LocationPermission>((resolve) => (answer = resolve)),
      currentPosition: () => Promise.resolve(SIMULATOR_POSITION),
    };
    const client = new FakeLotsClient(parkingDemoWith(2));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderHomeScreen(client, 'fr', location);

    await act(() => screen.unmount());
    await act(async () => answer('granted'));
    await waitForRefresh();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});


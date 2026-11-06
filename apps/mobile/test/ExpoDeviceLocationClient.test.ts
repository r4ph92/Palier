import * as Location from 'expo-location';
import {
  ALWAYS_REQUEST_TIMEOUT_MILLISECONDS,
  CURRENT_POSITION_TIMEOUT_MILLISECONDS,
  ExpoDeviceLocationClient,
  LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS,
} from '../src/deviceLocation/ExpoDeviceLocationClient';
import { SIMULATOR_POSITION } from './fakeDeviceLocationClient';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mockedLocation = jest.mocked(Location);
const simulatorFix = { coords: { ...SIMULATOR_POSITION, accuracy: 5 }, timestamp: 0 } as Location.LocationObject;

beforeEach(() => jest.clearAllMocks());

describe('ExpoDeviceLocationClient permission', () => {
  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['undetermined', 'denied'],
  ])('answers %s from the system as %s', async (status, expected) => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status } as Location.LocationPermissionResponse);

    await expect(new ExpoDeviceLocationClient().requestWhileInUse()).resolves.toBe(expected);
  });
});

describe('ExpoDeviceLocationClient « Always »', () => {
  const answer = (status: string) => ({ status }) as Location.LocationPermissionResponse;
  afterEach(() => jest.useRealTimers());

  it('asks iOS for the background permission', async () => {
    mockedLocation.requestBackgroundPermissionsAsync.mockResolvedValue(answer('granted'));

    await new ExpoDeviceLocationClient().requestAlways();

    expect(mockedLocation.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for « Always » after 30 seconds when iOS never answers', async () => {
    jest.useFakeTimers();
    mockedLocation.requestBackgroundPermissionsAsync.mockReturnValue(new Promise(() => undefined));

    const request = new ExpoDeviceLocationClient().requestAlways();
    await jest.advanceTimersByTimeAsync(ALWAYS_REQUEST_TIMEOUT_MILLISECONDS);

    await expect(request).resolves.toBeUndefined();
  });

  it.each([
    ['granted', true],
    ['denied', false],
    ['undetermined', false],
  ])('answers %s from the system as hasAlways %s', async (status, expected) => {
    mockedLocation.getBackgroundPermissionsAsync.mockResolvedValue(answer(status));

    await expect(new ExpoDeviceLocationClient().hasAlways()).resolves.toBe(expected);
  });
});

describe('ExpoDeviceLocationClient position', () => {
  afterEach(() => jest.useRealTimers());

  it('takes a last known position of the last minute without waiting for a fresh one', async () => {
    mockedLocation.getLastKnownPositionAsync.mockResolvedValue(simulatorFix);

    await expect(new ExpoDeviceLocationClient().currentPosition()).resolves.toEqual(SIMULATOR_POSITION);
    expect(mockedLocation.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS });
    expect(mockedLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reads a fresh position at balanced accuracy when none is recent', async () => {
    mockedLocation.getLastKnownPositionAsync.mockResolvedValue(null);
    mockedLocation.getCurrentPositionAsync.mockResolvedValue(simulatorFix);

    await expect(new ExpoDeviceLocationClient().currentPosition()).resolves.toEqual(SIMULATOR_POSITION);
    expect(mockedLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it('gives up on a fresh position after 5 seconds', async () => {
    jest.useFakeTimers();
    mockedLocation.getLastKnownPositionAsync.mockResolvedValue(null);
    mockedLocation.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));

    const position = new ExpoDeviceLocationClient().currentPosition();
    await jest.advanceTimersByTimeAsync(CURRENT_POSITION_TIMEOUT_MILLISECONDS);

    await expect(position).resolves.toBeNull();
  });
});

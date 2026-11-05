import * as Location from 'expo-location';
import {
  CURRENT_POSITION_TIMEOUT_MILLISECONDS,
  ExpoDeviceLocationClient,
  LAST_KNOWN_POSITION_MAX_AGE_MILLISECONDS,
} from '../src/deviceLocation/ExpoDeviceLocationClient';
import { SIMULATOR_POSITION } from './fakeDeviceLocationClient';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
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

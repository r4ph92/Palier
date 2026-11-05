import type { DeviceLocationClient } from '../src/deviceLocation/DeviceLocationClient';
import { locateDriver } from '../src/deviceLocation/locateDriver';
import { FakeDeviceLocationClient, SIMULATOR_POSITION } from './fakeDeviceLocationClient';

describe('locateDriver', () => {
  it('gives the position when the driver allows location', async () => {
    await expect(locateDriver(new FakeDeviceLocationClient())).resolves.toEqual({ status: 'located', position: SIMULATOR_POSITION });
  });

  it('reads no position when the driver denies location', async () => {
    const client = new FakeDeviceLocationClient('denied');

    await expect(locateDriver(client)).resolves.toEqual({ status: 'denied' });
    expect(client.positionReads).toBe(0);
  });

  it('counts a failed permission request as denied', async () => {
    await expect(locateDriver(new FakeDeviceLocationClient('failing'))).resolves.toEqual({ status: 'denied' });
  });

  it('says the position is unavailable when the device has none', async () => {
    await expect(locateDriver(new FakeDeviceLocationClient('granted', null))).resolves.toEqual({ status: 'unavailable' });
  });

  it('says the position is unavailable when reading it fails', async () => {
    const failingRead: DeviceLocationClient = {
      requestWhileInUse: () => Promise.resolve('granted'),
      currentPosition: () => Promise.reject(new Error('location services off')),
    };

    await expect(locateDriver(failingRead)).resolves.toEqual({ status: 'unavailable' });
  });
});

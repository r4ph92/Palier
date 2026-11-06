import type { BackgroundLocationClient } from '../src/deviceLocation/BackgroundLocationClient';

export class FakeBackgroundLocationClient implements BackgroundLocationClient {
  alwaysRequests = 0;
  hasAlwaysPermission = true;
  failAlwaysRequest = false;

  requestAlways(): Promise<void> {
    this.alwaysRequests += 1;
    return this.failAlwaysRequest ? Promise.reject(new Error('fake always failure')) : Promise.resolve();
  }

  hasAlways(): Promise<boolean> {
    return Promise.resolve(this.hasAlwaysPermission);
  }
}

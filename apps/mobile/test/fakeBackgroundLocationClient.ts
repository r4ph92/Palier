import type { BackgroundLocationClient, BackgroundLocationStatus } from '../src/deviceLocation/BackgroundLocationClient';

export class FakeBackgroundLocationClient implements BackgroundLocationClient {
  alwaysRequests = 0;
  status: BackgroundLocationStatus = 'always';
  failAlwaysRequest = false;

  requestAlways(): Promise<void> {
    this.alwaysRequests += 1;
    return this.failAlwaysRequest ? Promise.reject(new Error('fake always failure')) : Promise.resolve();
  }

  backgroundStatus(): Promise<BackgroundLocationStatus> {
    return Promise.resolve(this.status);
  }
}

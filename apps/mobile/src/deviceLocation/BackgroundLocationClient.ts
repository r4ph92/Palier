// « always » lets the app detect the parked spot after the scan; « limited » is « While using the app ».
export type BackgroundLocationStatus = 'always' | 'limited' | 'denied';

export interface BackgroundLocationClient {
  requestAlways(): Promise<void>;
  backgroundStatus(): Promise<BackgroundLocationStatus>;
}

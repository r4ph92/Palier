export interface BackgroundLocationClient {
  requestAlways(): Promise<void>;
  hasAlways(): Promise<boolean>;
}

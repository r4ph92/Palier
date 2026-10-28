import type { Driver } from './Driver.ts';

export interface DriverRepository {
  listDrivers(): Promise<readonly Driver[]>;
  findDriver(driverId: string): Promise<Driver | null>;
  saveSessionToken(driverId: string, tokenHash: string): Promise<void>;
  findDriverBySessionToken(tokenHash: string): Promise<Driver | null>;
  revokeSessionToken(tokenHash: string): Promise<void>;
}

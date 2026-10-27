import type { AuthenticatedGate } from './AuthenticatedGate.ts';

export interface DeviceKeyRecord {
  readonly gate: AuthenticatedGate;
  readonly revokedAt: Date | null;
}

export interface GateDeviceKeyRepository {
  findByKeyHash(keyHash: string): Promise<DeviceKeyRecord | undefined>;
}

import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { GateDeviceKeyRepository } from './GateDeviceKeyRepository.ts';
import { hashDeviceKey } from './hashDeviceKey.ts';

export async function authenticateDeviceKey(
  deviceKey: string,
  repository: GateDeviceKeyRepository,
): Promise<AuthenticatedGate | undefined> {
  const record = await repository.findByKeyHash(hashDeviceKey(deviceKey));
  if (record === undefined || record.revokedAt !== null) {
    return undefined;
  }
  return record.gate;
}

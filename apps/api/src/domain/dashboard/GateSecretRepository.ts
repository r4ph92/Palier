import type { GatePlace, GateWrite, LotGateRefusal } from './LotGateRepository.ts';

export type QrSecretRead = { readonly kind: 'secret'; readonly qrSecret: string } | { readonly kind: 'refused'; readonly reason: LotGateRefusal };

// Each change runs under the operator's lot lock, so two rotations of one gate never interleave.
export interface GateSecretRepository {
  // Revokes every live key of the gate and stores the new one's hash, in one transaction.
  replaceDeviceKey(operatorId: string, gate: GatePlace, deviceKeyHash: string): Promise<GateWrite>;
  // Every QR printed before is refused from the next scan on: the entry reads the secret at each scan.
  replaceQrSecret(operatorId: string, gate: GatePlace, qrSecret: string): Promise<GateWrite>;
  // The gate's QR secret; a gate without a usable one stores spareSecret first, and nothing else changes.
  usableQrSecret(operatorId: string, gate: GatePlace, spareSecret: string): Promise<QrSecretRead>;
}

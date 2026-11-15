import type { GateDeviceKey, GateQrLink } from '@palier/shared-types';
import { gateQrLink } from '../entries/gateToken.ts';
import { hashDeviceKey } from '../gates/hashDeviceKey.ts';
import { newDeviceKey, newQrSecret } from '../gates/newGateSecret.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { GateSecretRepository } from './GateSecretRepository.ts';
import { gatePlaceOf, writtenGateIdOf, type MemberGate } from './lotGates.ts';
import { operatorIdOfMember, type MemberOperators } from './memberOperator.ts';

export interface GateSecretSources {
  readonly operators: MemberOperators;
  readonly secrets: GateSecretRepository;
}

// The controller holding the old key is refused from its next call; the new key is answered once, after the commit.
export async function replaceDeviceKeyOfMember({ operators, secrets }: GateSecretSources, gate: MemberGate): Promise<GateDeviceKey> {
  const deviceKey = newDeviceKey();
  const operatorId = await operatorIdOfMember(operators, gate);
  const gateId = writtenGateIdOf(await secrets.replaceDeviceKey(operatorId, gatePlaceOf(gate), hashDeviceKey(deviceKey)));
  return { gateId, deviceKey };
}

// Every QR printed before reads as not recognized from the next scan on.
export async function replaceQrSecretOfMember({ operators, secrets }: GateSecretSources, gate: MemberGate): Promise<void> {
  const operatorId = await operatorIdOfMember(operators, gate);
  writtenGateIdOf(await secrets.replaceQrSecret(operatorId, gatePlaceOf(gate), newQrSecret()));
}

// Only the signed link leaves the API, never the secret that signs it.
export async function qrLinkOfMember({ operators, secrets }: GateSecretSources, gate: MemberGate): Promise<GateQrLink> {
  const operatorId = await operatorIdOfMember(operators, gate);
  const read = await secrets.usableQrSecret(operatorId, gatePlaceOf(gate), newQrSecret());
  if (read.kind === 'refused') {
    throw new DashboardRefusedError(read.reason);
  }
  return { link: gateQrLink(gate.gateId, read.qrSecret) };
}

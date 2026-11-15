import type { CreatedGate, DashboardLotGates } from '@palier/shared-types';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { endpointOf, gateDraftErrors, gateSettingsErrors, type GateDraft, type GateDraftErrors, type GateSettings } from '@palier/shared-types/gateDraft';
import { hashDeviceKey } from '../gates/hashDeviceKey.ts';
import { newDeviceKey, newQrSecret } from '../gates/newGateSecret.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { GatePlace, GateWrite, LotGateRepository } from './LotGateRepository.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotGateSources {
  readonly operators: MemberOperators;
  readonly gates: LotGateRepository;
}

export interface MemberGate extends MemberLot {
  readonly gateId: string;
}

export async function readLotGatesOfMember(sources: LotGateSources, lot: MemberLot): Promise<DashboardLotGates> {
  return readOwnedLotGates(sources.gates, await operatorIdOfMember(sources.operators, lot), lot.lotId);
}

// The rule runs before any read, so a refused body says nothing about the lot. The key is answered once the gate is committed.
export async function addGateOfMember(sources: LotGateSources, lot: MemberLot, request: GateDraft): Promise<CreatedGate> {
  const draft = validatedDraft(request);
  const deviceKey = newDeviceKey();
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  const outcome = await sources.gates.addGate(operatorId, lot.lotId, { draft, qrSecret: newQrSecret(), deviceKeyHash: hashDeviceKey(deviceKey) });
  const gateId = writtenGateIdOf(outcome);
  return { gateId, deviceKey, lotGates: await readOwnedLotGates(sources.gates, operatorId, lot.lotId) };
}

export async function changeGateOfMember(sources: LotGateSources, gate: MemberGate, request: GateSettings): Promise<DashboardLotGates> {
  const settings = validatedSettings(request);
  const operatorId = await operatorIdOfMember(sources.operators, gate);
  writtenGateIdOf(await sources.gates.changeGate(operatorId, gatePlaceOf(gate), settings));
  return readOwnedLotGates(sources.gates, operatorId, gate.lotId);
}

export function writtenGateIdOf(outcome: GateWrite): string {
  if (outcome.kind === 'refused') {
    throw new DashboardRefusedError(outcome.reason);
  }
  return outcome.gateId;
}

export function gatePlaceOf({ lotId, gateId }: MemberGate): GatePlace {
  return { lotId, gateId };
}

async function readOwnedLotGates(gates: LotGateRepository, operatorId: string, lotId: string): Promise<DashboardLotGates> {
  return ownedLotOrNotFound(await gates.readLotGates(operatorId, lotId));
}

function validatedDraft(request: GateDraft): GateDraft {
  const draft = { ...settingsOf(request), kind: request.kind };
  refuseFirstError(gateDraftErrors(draft));
  return draft;
}

function validatedSettings(request: GateSettings): GateSettings {
  const settings = settingsOf(request);
  refuseFirstError(gateSettingsErrors(settings));
  return settings;
}

function refuseFirstError(errors: GateDraftErrors): void {
  const refusal = firstFieldError(errors);
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
}

// Built from its own keys only, the name trimmed and a blank endpoint read as none.
function settingsOf({ name, integrationKind, endpoint, reportsLoops, exitIdentification }: GateSettings): GateSettings {
  return { name: name.trim(), integrationKind, endpoint: endpoint === null ? null : endpointOf(endpoint), reportsLoops, exitIdentification };
}

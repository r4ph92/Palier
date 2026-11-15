import { randomUUID } from 'node:crypto';
import type { DashboardGate, DashboardLotGates } from '@palier/shared-types';
import { exitIdentificationErrorOf, MAX_GATES_PER_LOT, type GateSettings } from '@palier/shared-types/gateDraft';
import type { GateSecretRepository, QrSecretRead } from '../../../src/domain/dashboard/GateSecretRepository.ts';
import { gateRefused, gateWritten, type GatePlace, type GateWrite, type LotGateRepository, type NewGate } from '../../../src/domain/dashboard/LotGateRepository.ts';
import { isUsableQrSecret } from '../../../src/domain/entries/gateToken.ts';
import { EXIT_ID_KIND_OF, EXIT_IDENTIFICATION_OF } from '../../../src/domain/gates/AuthenticatedGate.ts';
import type { DeviceKeyRecord, GateDeviceKeyRepository } from '../../../src/domain/gates/GateDeviceKeyRepository.ts';
import { gateDeviceKeyFixtures, gateFixtures } from '../../../src/seed/fixtures/gates.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

export interface FakeGate extends DashboardGate {
  readonly lotId: string;
  qrSecret: string | null;
}

interface FakeDeviceKey {
  readonly gateId: string;
  readonly keyHash: string;
  revokedAt: Date | null;
}

function seededGates(): FakeGate[] {
  return gateFixtures.map(({ id = '', lotId, name, kind, integrationKind, endpoint = null, hasLoops = false, exitIdKind = 'NONE', qrSecret = null }) => ({
    ...{ id, lotId, name, kind, integrationKind, endpoint, qrSecret },
    ...{ reportsLoops: hasLoops, exitIdentification: EXIT_IDENTIFICATION_OF[exitIdKind] },
  }));
}

function seededKeys(): FakeDeviceKey[] {
  return gateDeviceKeyFixtures.map(({ gateId, keyHash, revokedAt = null }) => ({ gateId, keyHash, revokedAt }));
}

// Keeps the rules the SQL keeps: the operator's lot, a gate of that lot, the limits counted under the lock, names unique per lot.
// Device authentication reads the same keys, so a rotated key is refused at the next heartbeat.
export class FakeLotGateRepository implements LotGateRepository, GateSecretRepository, GateDeviceKeyRepository {
  readonly gates: FakeGate[] = seededGates();
  readonly deviceKeys: FakeDeviceKey[] = seededKeys();
  readonly busyLots = new Set<string>();
  readonly #lots: FakeLotStore;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  readLotGates(operatorId: string, lotId: string): Promise<DashboardLotGates | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    if (lot === undefined) {
      return Promise.resolve(null);
    }
    const gates = this.#gatesOf(lotId).sort(inListOrder).map(dashboardGateOf);
    return Promise.resolve({ lotId, lotName: lot.name, gates });
  }

  addGate(operatorId: string, lotId: string, { draft, qrSecret, deviceKeyHash }: NewGate): Promise<GateWrite> {
    return this.#write(operatorId, lotId, () => {
      const lotGates = this.#gatesOf(lotId);
      if (lotGates.length >= MAX_GATES_PER_LOT) {
        return gateRefused('GATE_LIMIT_REACHED');
      }
      if (draft.kind === 'EXIT' && lotGates.some(({ kind }) => kind === 'EXIT')) {
        return gateRefused('GATE_EXIT_LIMIT');
      }
      if (lotGates.some(({ name }) => name === draft.name)) {
        return gateRefused('GATE_NAME_TAKEN');
      }
      const id = randomUUID();
      this.gates.push({ ...draft, id, lotId, qrSecret });
      this.deviceKeys.push({ gateId: id, keyHash: deviceKeyHash, revokedAt: null });
      return gateWritten(id);
    });
  }

  changeGate(operatorId: string, place: GatePlace, settings: GateSettings): Promise<GateWrite> {
    return this.#writeGate(operatorId, place, (gate) => {
      const refusal = exitIdentificationErrorOf(gate.kind, settings.exitIdentification);
      if (refusal !== null) {
        return gateRefused(refusal);
      }
      if (this.#gatesOf(place.lotId).some(({ id, name }) => name === settings.name && id !== gate.id)) {
        return gateRefused('GATE_NAME_TAKEN');
      }
      Object.assign(gate, settings);
      return gateWritten(gate.id);
    });
  }

  replaceDeviceKey(operatorId: string, place: GatePlace, deviceKeyHash: string): Promise<GateWrite> {
    return this.#writeGate(operatorId, place, (gate) => {
      this.deviceKeys.filter((key) => key.gateId === gate.id && key.revokedAt === null).forEach((key) => (key.revokedAt = new Date()));
      this.deviceKeys.push({ gateId: gate.id, keyHash: deviceKeyHash, revokedAt: null });
      return gateWritten(gate.id);
    });
  }

  replaceQrSecret(operatorId: string, place: GatePlace, qrSecret: string): Promise<GateWrite> {
    return this.#writeGate(operatorId, place, (gate) => {
      gate.qrSecret = qrSecret;
      return gateWritten(gate.id);
    });
  }

  async usableQrSecret(operatorId: string, place: GatePlace, spareSecret: string): Promise<QrSecretRead> {
    let qrSecret = spareSecret;
    const outcome = await this.#writeGate(operatorId, place, (gate) => {
      gate.qrSecret = isUsableQrSecret(gate.qrSecret) ? gate.qrSecret : spareSecret;
      qrSecret = gate.qrSecret;
      return gateWritten(gate.id);
    });
    return outcome.kind === 'refused' ? outcome : { kind: 'secret', qrSecret };
  }

  findByKeyHash(keyHash: string): Promise<DeviceKeyRecord | undefined> {
    const key = this.deviceKeys.find((stored) => stored.keyHash === keyHash);
    const gate = this.gates.find(({ id }) => id === key?.gateId);
    if (key === undefined || gate === undefined) {
      return Promise.resolve(undefined);
    }
    const { id, lotId, name, kind, reportsLoops, exitIdentification } = gate;
    const authenticated = { id, lotId, name, kind, hasLoops: reportsLoops, exitIdKind: EXIT_ID_KIND_OF[exitIdentification], lotName: this.#lots.byId(lotId)?.name ?? '' };
    return Promise.resolve({ gate: authenticated, revokedAt: key.revokedAt });
  }

  #writeGate(operatorId: string, place: GatePlace, change: (gate: FakeGate) => GateWrite): Promise<GateWrite> {
    return this.#write(operatorId, place.lotId, () => {
      const gate = this.#gateOf(place);
      return gate === undefined ? gateRefused('GATE_NOT_FOUND') : change(gate);
    });
  }

  #write(operatorId: string, lotId: string, change: () => GateWrite): Promise<GateWrite> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve(gateRefused('LOT_NOT_FOUND'));
    }
    return Promise.resolve(this.busyLots.has(lotId) ? gateRefused('LOT_BUSY') : change());
  }

  #gatesOf(lotId: string): FakeGate[] {
    return this.gates.filter((gate) => gate.lotId === lotId);
  }

  #gateOf({ lotId, gateId }: GatePlace): FakeGate | undefined {
    return this.#gatesOf(lotId).find(({ id }) => id === gateId);
  }
}

function dashboardGateOf({ id, name, kind, integrationKind, endpoint, reportsLoops, exitIdentification }: FakeGate): DashboardGate {
  return { id, name, kind, integrationKind, endpoint, reportsLoops, exitIdentification };
}

function inListOrder(left: FakeGate, right: FakeGate): number {
  return left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name);
}

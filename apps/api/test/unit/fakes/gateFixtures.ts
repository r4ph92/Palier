import type { AuthenticatedGate } from '../../../src/domain/gates/AuthenticatedGate.ts';
import type { DeviceKeyRecord, GateDeviceKeyRepository } from '../../../src/domain/gates/GateDeviceKeyRepository.ts';
import { hashDeviceKey } from '../../../src/domain/gates/hashDeviceKey.ts';
import type { PassageEntry, PassageLedger, RecordedPassage } from '../../../src/domain/gates/PassageLedger.ts';

export const ENTREE_DEMO_KEY = 'entreeDemoKey000000000000000000000000000000';
export const SORTIE_DEMO_KEY = 'sortieDemoKey000000000000000000000000000000';
export const REVOKED_KEY = 'revokedDemoKey00000000000000000000000000000';
export const UNKNOWN_KEY = 'unknownDemoKey00000000000000000000000000000';

export const entreeDemo: AuthenticatedGate = {
  id: '00000000-0000-4000-8000-000000000501',
  lotId: '00000000-0000-4000-8000-000000000201',
  lotName: 'Parking Démo',
  name: 'Entrée Démo',
  kind: 'ENTRY',
  hasLoops: true,
};

export const sortieDemo: AuthenticatedGate = {
  ...entreeDemo,
  id: '00000000-0000-4000-8000-000000000502',
  name: 'Sortie Démo',
  kind: 'EXIT',
};

export class FakeGateDeviceKeyRepository implements GateDeviceKeyRepository {
  readonly #records = new Map<string, DeviceKeyRecord>([
    [hashDeviceKey(ENTREE_DEMO_KEY), { gate: entreeDemo, revokedAt: null }],
    [hashDeviceKey(SORTIE_DEMO_KEY), { gate: sortieDemo, revokedAt: null }],
    [hashDeviceKey(REVOKED_KEY), { gate: entreeDemo, revokedAt: new Date('2026-10-15T12:00:00Z') }],
  ]);

  findByKeyHash(keyHash: string): Promise<DeviceKeyRecord | undefined> {
    return Promise.resolve(this.#records.get(keyHash));
  }

  withGate(deviceKey: string, gate: AuthenticatedGate): this {
    this.#records.set(hashDeviceKey(deviceKey), { gate, revokedAt: null });
    return this;
  }
}

export class FakePassageLedger implements PassageLedger {
  readonly entries: PassageEntry[] = [];
  vehicleCount: number;

  constructor(vehicleCount = 0) {
    this.vehicleCount = vehicleCount;
  }

  recordPassage(entry: PassageEntry): Promise<RecordedPassage> {
    this.entries.push(entry);
    this.vehicleCount = Math.max(this.vehicleCount + entry.vehicleCountChange, 0);
    return Promise.resolve({ vehicleCount: this.vehicleCount });
  }
}

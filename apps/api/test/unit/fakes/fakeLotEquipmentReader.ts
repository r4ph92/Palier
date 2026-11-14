import type { LotEquipmentReader, LotGates, StoredGate } from '../../../src/domain/dashboard/LotEquipmentReader.ts';
import { ENTREE_DEMO_ID, ENTREE_ROY_ID, SORTIE_DEMO_ID } from '../../../src/seed/fixtures/gates.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

// The seeded gates, never heard until a test stamps a heartbeat.
function seededGates(): Map<string, StoredGate[]> {
  return new Map([
    [
      PARKING_DEMO_ID,
      [
        { id: ENTREE_DEMO_ID, name: 'Entrée Démo', kind: 'ENTRY', lastHeartbeatAt: null },
        { id: SORTIE_DEMO_ID, name: 'Sortie Démo', kind: 'EXIT', lastHeartbeatAt: null },
      ],
    ],
    [GARAGE_ROY_ID, [{ id: ENTREE_ROY_ID, name: 'Entrée Roy', kind: 'ENTRY', lastHeartbeatAt: null }]],
  ]);
}

// Answers only for a lot of the operator asking, like the SQL does.
export class FakeLotEquipmentReader implements LotEquipmentReader {
  readonly #lots: FakeLotStore;
  readonly #gates = seededGates();

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  stampHeartbeat(gateId: string, at: Date): void {
    for (const [lotId, gates] of this.#gates) {
      this.#gates.set(lotId, gates.map((gate) => (gate.id === gateId ? { ...gate, lastHeartbeatAt: at } : gate)));
    }
  }

  readLotGates(operatorId: string, lotId: string): Promise<LotGates | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    return Promise.resolve(lot === undefined ? null : { lotName: lot.name, gates: this.#gates.get(lotId) ?? [] });
  }
}

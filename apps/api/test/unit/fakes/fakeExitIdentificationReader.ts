import type { ExitCountsRead, ExitIdentificationReader, RecordedExitCounts } from '../../../src/domain/dashboard/ExitIdentificationReader.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

// The story's Parking Démo: 10 exits, 5 by beacon, 3 by app tap, 2 by plate.
export const parkingDemoExitCounts: RecordedExitCounts = { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0 };

// Answers only for a lot of the operator asking, like the SQL does, and remembers the cutoff it was given.
export class FakeExitIdentificationReader implements ExitIdentificationReader {
  readonly #lots: FakeLotStore;
  readonly #counts = new Map<string, ExitCountsRead>([
    [PARKING_DEMO_ID, { lotName: 'Parking Démo', counts: parkingDemoExitCounts }],
    [GARAGE_ROY_ID, { lotName: 'Garage Roy', counts: { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 0 } }],
  ]);
  lastCutoff: Date | null = null;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  set(lotId: string, read: ExitCountsRead): void {
    this.#counts.set(lotId, read);
  }

  readExitCounts(operatorId: string, lotId: string, since: Date): Promise<ExitCountsRead | null> {
    this.lastCutoff = since;
    const owned = this.#lots.indexOf(operatorId, lotId) >= 0;
    return Promise.resolve(owned ? (this.#counts.get(lotId) ?? null) : null);
  }
}

import { missingPrerequisitesOf, type PublicationFacts } from '../../../src/domain/publication/lotPrerequisites.ts';
import type { LotAttestation, LotPublicationRepository, OnlineChange, PublicationWrite } from '../../../src/domain/publication/LotPublicationRepository.ts';
import type { FakeLotStore, OwnedLot } from './fakeLotSetupRepository.ts';

const ATTESTATION_FIELD = { WIFI: 'wifi', CELLULAR: 'cellular' } as const;

// Keeps the rules the SQL keeps: the operator's lot, the checklist judged before going online, the lot store's state written with it.
// A lot no test described reads as the store has it, with nothing verified around it.
export class FakeLotPublicationRepository implements LotPublicationRepository {
  readonly busyLots = new Set<string>();
  readonly changes: OnlineChange[] = [];
  readonly #facts = new Map<string, PublicationFacts>();
  readonly #lots: FakeLotStore;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  // Adds the lot to the operator's lots, as the lot creation flow would, with these facts around it.
  withLot(operatorId: string, facts: PublicationFacts): this {
    const lot = this.#lots.byId(facts.lotId);
    if (lot === undefined) {
      this.#lots.owned.push(ownedLotOf(operatorId, facts));
    }
    this.#facts.set(facts.lotId, facts);
    return this;
  }

  readPublicationFacts(operatorId: string, lotId: string): Promise<PublicationFacts | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    return Promise.resolve(lot === undefined ? null : this.#factsOf(lot));
  }

  attest(operatorId: string, lotId: string, { kind, measuredOn, note }: LotAttestation): Promise<PublicationWrite> {
    return this.#write(operatorId, lotId, (facts) => {
      this.#facts.set(lotId, { ...facts, [ATTESTATION_FIELD[kind]]: { measuredOn, note } });
      return 'written';
    });
  }

  changeOnline(operatorId: string, lotId: string, change: OnlineChange): Promise<PublicationWrite> {
    return this.#write(operatorId, lotId, (facts) => {
      if (change.online && !facts.isOnline && missingPrerequisitesOf(facts).length > 0) {
        return 'LOT_NOT_READY';
      }
      this.changes.push(change);
      this.#facts.set(lotId, { ...facts, isOnline: change.online });
      this.#setStoredOnline(lotId, change.online);
      return 'written';
    });
  }

  #write(operatorId: string, lotId: string, change: (facts: PublicationFacts) => PublicationWrite): Promise<PublicationWrite> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    if (lot === undefined) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    return Promise.resolve(this.busyLots.has(lotId) ? 'LOT_BUSY' : change(this.#factsOf(lot)));
  }

  #factsOf(lot: OwnedLot): PublicationFacts {
    return this.#facts.get(lot.id) ?? storedFactsOf(lot);
  }

  #setStoredOnline(lotId: string, isOnline: boolean): void {
    const index = this.#lots.owned.findIndex(({ id }) => id === lotId);
    const lot = this.#lots.owned[index];
    if (lot !== undefined) {
      this.#lots.owned[index] = { ...lot, isOnline };
    }
  }
}

function storedFactsOf(lot: OwnedLot): PublicationFacts {
  return {
    ...{ lotId: lot.id, lotName: lot.name, isOnline: lot.isOnline, stripe: { kycStatus: 'NOT_STARTED' } },
    ...{ pricing: { dailyCapCents: lot.pricing?.dailyCapCents ?? null }, spots: { inServiceCount: 0, capacity: lot.capacity } },
    ...{ wifi: null, cellular: null, gates: [] },
  };
}

function ownedLotOf(operatorId: string, facts: PublicationFacts): OwnedLot {
  const pricing = facts.pricing.dailyCapCents === null ? null : { incrementCents: 75, incrementMinutes: 15, dailyCapCents: facts.pricing.dailyCapCents, holdQuota: 3 };
  return { operatorId, id: facts.lotId, name: facts.lotName, isOnline: facts.isOnline, address: '4600, boulevard Saint-Laurent, Montréal (Québec)', latitude: 45.53, longitude: -73.59, capacity: facts.spots.capacity, beaconMajor: 9, pricing };
}

import { randomUUID } from 'node:crypto';
import type { DashboardLot, DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricing } from '@palier/shared-types/lotPricing';
import type { LotSetupRepository } from '../../../src/domain/dashboard/LotSetupRepository.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from '../../../src/seed/fixtures/operators.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../../src/seed/fixtures/parkingTestPaliers.ts';

export interface OwnedLot extends DashboardLotDetails {
  readonly operatorId: string;
}

const FIRST_CREATED_MAJOR = 4;
export const seededPricing: LotPricing = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500, holdQuota: 3 };

export const parkingDemoDetails: DashboardLotDetails = {
  id: PARKING_DEMO_ID,
  name: 'Parking Démo',
  isOnline: true,
  address: '500, rue Peel, Montréal (Québec)',
  latitude: 45.50165,
  longitude: -73.5673,
  capacity: 10,
  beaconMajor: 1,
  pricing: seededPricing,
};

export const parkingTestPaliersDetails: DashboardLotDetails = {
  ...parkingDemoDetails,
  id: PARKING_TEST_PALIERS_ID,
  name: 'Parking Test Paliers',
  isOnline: false,
  address: '1000, rue Sanguinet, Montréal (Québec)',
  capacity: 6,
  beaconMajor: 3,
};

export const garageRoyDetails: DashboardLotDetails = {
  ...parkingDemoDetails,
  id: GARAGE_ROY_ID,
  name: 'Garage Roy',
  isOnline: false,
  address: '4500, boulevard Saint-Laurent, Montréal (Québec)',
  latitude: 45.52,
  longitude: -73.58,
  capacity: 0,
  beaconMajor: 2,
};

// The lots of both operators, as seeded; lot setup writes here and the operator list reads here.
export class FakeLotStore {
  readonly lots: OwnedLot[] = [
    { ...parkingDemoDetails, operatorId: LAVOIE_OPERATOR_ID },
    { ...parkingTestPaliersDetails, operatorId: LAVOIE_OPERATOR_ID },
    { ...garageRoyDetails, operatorId: ROY_OPERATOR_ID },
  ];

  lotsOf(operatorId: string): readonly DashboardLot[] {
    return this.lots
      .filter((lot) => lot.operatorId === operatorId)
      .map(({ id, name, isOnline }) => ({ id, name, isOnline }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  indexOf(operatorId: string, lotId: string): number {
    return this.lots.findIndex((lot) => lot.id === lotId && lot.operatorId === operatorId);
  }
}

export class FakeLotSetupRepository implements LotSetupRepository {
  readonly #store: FakeLotStore;
  #nextMajor = FIRST_CREATED_MAJOR;

  constructor(store: FakeLotStore) {
    this.#store = store;
  }

  createLot(operatorId: string, draft: LotDraft): Promise<DashboardLotDetails> {
    const created: OwnedLot = { ...draft, id: randomUUID(), isOnline: false, beaconMajor: this.#nextMajor++, pricing: null, operatorId };
    this.#store.lots.push(created);
    return Promise.resolve(withoutOwner(created));
  }

  updateLotPricing(operatorId: string, lotId: string, pricing: LotPricing): Promise<DashboardLotDetails | null> {
    const index = this.#store.indexOf(operatorId, lotId);
    const found = this.#store.lots[index];
    if (found === undefined) {
      return Promise.resolve(null);
    }
    this.#store.lots[index] = { ...found, pricing };
    return Promise.resolve(withoutOwner({ ...found, pricing }));
  }

  findLotDetailsOfOperator(operatorId: string, lotId: string): Promise<DashboardLotDetails | null> {
    const found = this.#store.lots[this.#store.indexOf(operatorId, lotId)];
    return Promise.resolve(found === undefined ? null : withoutOwner(found));
  }
}

function withoutOwner(lot: OwnedLot): DashboardLotDetails {
  const { id, name, isOnline, address, latitude, longitude, capacity, beaconMajor, pricing } = lot;
  return { id, name, isOnline, address, latitude, longitude, capacity, beaconMajor, pricing };
}

import type { DashboardLot, DashboardLotDetails, DashboardLotMap, DashboardLotOccupancy, DashboardMeResponse, DashboardOperator, DashboardSpotToCheck, DashboardUser, LotPricingSettings } from '@palier/shared-types';
import type { FakeSpot } from './fakeSpotData.ts';

export const sophie: DashboardUser = { id: '00000000-0000-4000-8000-000000000601', firstName: 'Sophie', lastName: 'Lavoie' };
export const pierre: DashboardUser = { id: '00000000-0000-4000-8000-000000000602', firstName: 'Pierre', lastName: 'Roy' };
export const nouvelOperateur: DashboardUser = { id: '00000000-0000-4000-8000-000000000603', firstName: 'Nouvel', lastName: 'Opérateur' };
export const julie: DashboardUser = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };

export const lavoie: DashboardOperator = { id: '00000000-0000-4000-8000-000000000101', legalName: 'Stationnements Lavoie inc.', kycStatus: 'VERIFIED' };
const roy: DashboardOperator = { id: '00000000-0000-4000-8000-000000000102', legalName: 'Garages Roy', kycStatus: 'NOT_STARTED' };
const seededPricing: LotPricingSettings = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500, holdQuota: 3 };
export const parkingDemo: DashboardLotDetails = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Parking Démo',
  isOnline: true,
  address: '500, rue Peel, Montréal (Québec)',
  latitude: 45.50165,
  longitude: -73.5673,
  capacity: 10,
  beaconMajor: 1,
  pricing: seededPricing,
};
const parkingTestPaliers: DashboardLotDetails = {
  ...parkingDemo,
  id: '00000000-0000-4000-8000-000000000203',
  name: 'Parking Test Paliers',
  isOnline: false,
  address: '1000, rue Sanguinet, Montréal (Québec)',
  beaconMajor: 3,
};
// Without pricing, so Pierre's lot page shows the empty pricing state.
export const garageRoy: DashboardLotDetails = {
  ...parkingDemo,
  id: '00000000-0000-4000-8000-000000000202',
  name: 'Garage Roy',
  isOnline: false,
  address: '4500, boulevard Saint-Laurent, Montréal (Québec)',
  capacity: 0,
  beaconMajor: 2,
  pricing: null,
};

export interface FakeResponse {
  readonly status: number;
  readonly body?: unknown;
}

export const refused = (status: number, error: string): FakeResponse => ({ status, body: { statusCode: status, error, message: error } });

// 'pending' never answers, for the states shown while a request is on its way.
export type FakeAnswer = FakeResponse | 'pending';

export interface FakeApiState {
  me: DashboardMeResponse | null;
  readonly testUsersListed: boolean;
  readonly requests: string[];
  // Answers by "METHOD /path" that replace the fake's own; a test deletes one to let the request succeed again.
  readonly answers: Map<string, FakeAnswer>;
  // Every answer given so far, so a test can wait until the page has received them all.
  readonly answered: Promise<Response>[];
  // Each test starts from the seeded lots; creating a lot or saving pricing changes this copy.
  readonly lots: Map<string, DashboardLotDetails[]>;
  // By lot id; a test replaces an entry to change what the next poll reads.
  readonly occupancy: Map<string, DashboardLotOccupancy>;
  // By lot id; level and aisle writes change this copy.
  readonly maps: Map<string, DashboardLotMap>;
  // By lot id, every live spot of the lot; spot writes change this copy.
  readonly spots: Map<string, FakeSpot[]>;
  // By lot id, the spots flagged for a check, oldest first; a clear changes this copy.
  readonly spotsToCheck: Map<string, DashboardSpotToCheck[]>;
}

const operatorsByUser = new Map<string, DashboardOperator>([[sophie.id, lavoie], [pierre.id, roy]]);
const lotsByOperator = new Map<string, readonly DashboardLotDetails[]>([[lavoie.id, [parkingDemo, parkingTestPaliers]], [roy.id, [garageRoy]]]);

// The story's Parking Démo: 3 occupied, 1 assigned with its entry confirmed, 1 held, 1 occupied-unknown, 1 out of service, 3 free, 7 vehicles counted.
export const parkingDemoOccupancy: DashboardLotOccupancy = {
  lotId: parkingDemo.id,
  lotName: parkingDemo.name,
  vehicleCount: 7,
  levels: [{ code: 'P1', counts: { AVAILABLE: 3, HELD: 1, ASSIGNED: 1, OCCUPIED: 3, OCCUPIED_UNKNOWN: 1, OUT_OF_SERVICE: 1 } }],
  occupiedOrAssignedCount: 5,
  counterGap: { kind: 'SPOTS_TO_CHECK', spots: 2 },
};

export function seededOccupancy(): Map<string, DashboardLotOccupancy> {
  const garageRoyOccupancy: DashboardLotOccupancy = {
    lotId: garageRoy.id,
    lotName: garageRoy.name,
    vehicleCount: 0,
    levels: [],
    occupiedOrAssignedCount: 0,
    counterGap: { kind: 'SPOTS_TO_CHECK', spots: 0 },
  };
  return new Map([[parkingDemo.id, parkingDemoOccupancy], [garageRoy.id, garageRoyOccupancy]]);
}

export function seededLots(): Map<string, DashboardLotDetails[]> {
  return new Map([...lotsByOperator].map(([operatorId, lots]) => [operatorId, [...lots]]));
}

export function summaryOf({ id, name, isOnline }: DashboardLot): DashboardLot {
  return { id, name, isOnline };
}
export const testUsers: readonly DashboardUser[] = [sophie, pierre, nouvelOperateur, julie];

export function meFor(user: DashboardUser): DashboardMeResponse {
  return { user, operator: operatorsByUser.get(user.id) ?? null };
}

// Names that come from the seed, not from the dictionaries: a French lot or company name is data, not untranslated copy.
export const seededNames: readonly string[] = [
  ...testUsers.map(({ firstName, lastName }) => `${firstName} ${lastName}`),
  lavoie.legalName,
  roy.legalName,
  ...[...lotsByOperator.values()].flat().flatMap(({ name, address }) => [name, address]),
];

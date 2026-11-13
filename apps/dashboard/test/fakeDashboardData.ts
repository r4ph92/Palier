import type { DashboardLot, DashboardLotDetails, DashboardMeResponse, DashboardOperator, DashboardUser, LotPricingSettings } from '@palier/shared-types';

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
}

const operatorsByUser = new Map<string, DashboardOperator>([[sophie.id, lavoie], [pierre.id, roy]]);
const lotsByOperator = new Map<string, readonly DashboardLotDetails[]>([[lavoie.id, [parkingDemo, parkingTestPaliers]], [roy.id, [garageRoy]]]);

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

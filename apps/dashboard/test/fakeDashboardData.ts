import type { DashboardLot, DashboardMeResponse, DashboardOperator, DashboardUser } from '@palier/shared-types';

export const sophie: DashboardUser = { id: '00000000-0000-4000-8000-000000000601', firstName: 'Sophie', lastName: 'Lavoie' };
export const pierre: DashboardUser = { id: '00000000-0000-4000-8000-000000000602', firstName: 'Pierre', lastName: 'Roy' };
export const nouvelOperateur: DashboardUser = { id: '00000000-0000-4000-8000-000000000603', firstName: 'Nouvel', lastName: 'Opérateur' };
export const julie: DashboardUser = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };

export const lavoie: DashboardOperator = { id: '00000000-0000-4000-8000-000000000101', legalName: 'Stationnements Lavoie inc.', kycStatus: 'VERIFIED' };
const roy: DashboardOperator = { id: '00000000-0000-4000-8000-000000000102', legalName: 'Garages Roy', kycStatus: 'NOT_STARTED' };
export const parkingDemo: DashboardLot = { id: '00000000-0000-4000-8000-000000000201', name: 'Parking Démo', isOnline: true };
const parkingTestPaliers: DashboardLot = { id: '00000000-0000-4000-8000-000000000203', name: 'Parking Test Paliers', isOnline: false };
const garageRoy: DashboardLot = { id: '00000000-0000-4000-8000-000000000202', name: 'Garage Roy', isOnline: false };

export interface FakeResponse {
  readonly status: number;
  readonly body?: unknown;
}

// 'pending' never answers, for the states shown while a request is on its way.
export type FakeAnswer = FakeResponse | 'pending';

export interface FakeApiState {
  me: DashboardMeResponse | null;
  readonly testUsersListed: boolean;
  readonly requests: string[];
  // Answers by "METHOD /path" that replace the fake's own; a test deletes one to let the request succeed again.
  readonly answers: Map<string, FakeAnswer>;
}

const operatorsByUser = new Map<string, DashboardOperator>([[sophie.id, lavoie], [pierre.id, roy]]);
export const lotsByOperator = new Map<string, readonly DashboardLot[]>([[lavoie.id, [parkingDemo, parkingTestPaliers]], [roy.id, [garageRoy]]]);
export const testUsers: readonly DashboardUser[] = [sophie, pierre, nouvelOperateur, julie];

export function meFor(user: DashboardUser): DashboardMeResponse {
  return { user, operator: operatorsByUser.get(user.id) ?? null };
}

// Names that come from the seed, not from the dictionaries: a French lot or company name is data, not untranslated copy.
export const seededNames: readonly string[] = [
  ...testUsers.map(({ firstName, lastName }) => `${firstName} ${lastName}`),
  lavoie.legalName,
  roy.legalName,
  ...[...lotsByOperator.values()].flat().map(({ name }) => name),
];

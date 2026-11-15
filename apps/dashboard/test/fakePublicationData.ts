import type { LotPublication, PublicationGate } from '@palier/shared-types';
import { missingPrerequisitesOf } from './fakePublicationRules.ts';
import { garageRoy, parkingDemo } from './fakeDashboardData.ts';

// Local time, so the verified time reads the same in every time zone the tests run in.
export const VERIFIED_AT = new Date(2026, 10, 14, 15, 30);
export const MEASURED = { measuredOn: '2026-11-12', note: 'P1, P2: -62 dBm' } as const;

export const entreeDemoGate: PublicationGate = { id: '00000000-0000-4000-8000-000000000701', name: 'Entrée Démo', kind: 'ENTRY', verifiedAt: VERIFIED_AT.toISOString() };
export const sortieDemoGate: PublicationGate = { id: '00000000-0000-4000-8000-000000000702', name: 'Sortie Démo', kind: 'EXIT', verifiedAt: VERIFIED_AT.toISOString() };

type PublicationFacts = Omit<LotPublication, 'missing'>;

export function publicationOf(facts: PublicationFacts): LotPublication {
  return { ...facts, missing: missingPrerequisitesOf(facts) };
}

// Parking Démo as the demo needs it: every prerequisite met, still offline, so Sophie can put it online.
export function readyParkingDemo(change: Partial<PublicationFacts> = {}): LotPublication {
  return publicationOf({
    ...{ lotId: parkingDemo.id, lotName: parkingDemo.name, isOnline: false, stripe: { kycStatus: 'VERIFIED' }, pricing: { dailyCapCents: 2500 } },
    ...{ spots: { inServiceCount: 9, capacity: 10 }, wifi: MEASURED, cellular: MEASURED, gates: [entreeDemoGate, sortieDemoGate] },
    ...change,
  });
}

// Garage Roy has nothing yet: Pierre sees every line missing.
function bareGarageRoy(): LotPublication {
  return publicationOf({
    ...{ lotId: garageRoy.id, lotName: garageRoy.name, isOnline: false, stripe: { kycStatus: 'NOT_STARTED' }, pricing: { dailyCapCents: null } },
    ...{ spots: { inServiceCount: 0, capacity: 0 }, wifi: null, cellular: null, gates: [] },
  });
}

export function seededPublication(): Map<string, LotPublication> {
  return new Map([[parkingDemo.id, readyParkingDemo()], [garageRoy.id, bareGarageRoy()]]);
}

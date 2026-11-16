import type { PublicationGate } from '@palier/shared-types';
import type { PublicationFacts } from '../../../src/domain/publication/lotPrerequisites.ts';

export const GARAGE_ROY_NORD_ID = '00000000-0000-4000-8000-000000000268';
export const VERIFIED_AT = '2026-11-14T15:30:00.000Z';

export const entreeNord: PublicationGate = { id: '00000000-0000-4000-8000-000000000781', name: 'Entrée Nord', kind: 'ENTRY', verifiedAt: VERIFIED_AT };
export const sortieNord: PublicationGate = { id: '00000000-0000-4000-8000-000000000782', name: 'Sortie Nord', kind: 'EXIT', verifiedAt: VERIFIED_AT };

// Garage Roy Nord with every prerequisite met: Stripe verified, a 25 $ cap, 4 spots in service, both attestations, both gates verified.
export function readyGarageRoyNord(change: Partial<PublicationFacts> = {}): PublicationFacts {
  return {
    lotId: GARAGE_ROY_NORD_ID,
    lotName: 'Garage Roy Nord',
    isOnline: false,
    stripe: { kycStatus: 'VERIFIED' },
    pricing: { dailyCapCents: 2500 },
    spots: { inServiceCount: 4, capacity: 4 },
    wifi: { measuredOn: '2026-11-12', note: 'Signal mesuré aux niveaux P1 et P2.' },
    cellular: { measuredOn: '2026-11-12', note: 'Quatre barres aux deux bornes.' },
    gates: [entreeNord, sortieNord],
    ...change,
  };
}

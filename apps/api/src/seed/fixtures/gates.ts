import { hashDeviceKey } from '../../domain/gates/hashDeviceKey.ts';
import type { gate, gateDeviceKey } from '../../infrastructure/postgres/schema.ts';
import { GARAGE_ROY_ID } from './garageRoy.ts';
import { PARKING_DEMO_ID } from './parkingDemo.ts';

export const ENTREE_DEMO_ID = '00000000-0000-4000-8000-000000000501';
export const SORTIE_DEMO_ID = '00000000-0000-4000-8000-000000000502';
export const ENTREE_ROY_ID = '00000000-0000-4000-8000-000000000503';

export const ENTREE_DEMO_DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
export const SORTIE_DEMO_DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
export const ENTREE_ROY_DEVICE_KEY = 'qwWc90SgLYX15MzN2UBX8lSQA-hKBlaqbIG9v--98tM';
export const REVOKED_ENTREE_DEMO_DEVICE_KEY = 'L-xYpKfzUH4NHKxi_r6EKJbBXOIiYvhbawTSt34sgRs';

const VERIFIED_AT = new Date('2026-10-01T12:00:00Z');
const REVOKED_AT = new Date('2026-10-15T12:00:00Z');

export const gateFixtures: (typeof gate.$inferInsert)[] = [
  {
    id: ENTREE_DEMO_ID,
    lotId: PARKING_DEMO_ID,
    name: 'Entrée Démo',
    kind: 'ENTRY',
    integrationKind: 'SIMULATED',
    hasLoops: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: SORTIE_DEMO_ID,
    lotId: PARKING_DEMO_ID,
    name: 'Sortie Démo',
    kind: 'EXIT',
    integrationKind: 'SIMULATED',
    hasLoops: true,
    exitIdKind: 'NONE',
    verifiedAt: VERIFIED_AT,
  },
  { id: ENTREE_ROY_ID, lotId: GARAGE_ROY_ID, name: 'Entrée Roy', kind: 'ENTRY', integrationKind: 'DRY_CONTACT', hasLoops: true },
];

export const gateDeviceKeyFixtures: (typeof gateDeviceKey.$inferInsert)[] = [
  { id: '00000000-0000-4000-8000-000000000601', gateId: ENTREE_DEMO_ID, keyHash: hashDeviceKey(ENTREE_DEMO_DEVICE_KEY) },
  { id: '00000000-0000-4000-8000-000000000602', gateId: SORTIE_DEMO_ID, keyHash: hashDeviceKey(SORTIE_DEMO_DEVICE_KEY) },
  { id: '00000000-0000-4000-8000-000000000603', gateId: ENTREE_ROY_ID, keyHash: hashDeviceKey(ENTREE_ROY_DEVICE_KEY) },
  {
    id: '00000000-0000-4000-8000-000000000604',
    gateId: ENTREE_DEMO_ID,
    keyHash: hashDeviceKey(REVOKED_ENTREE_DEMO_DEVICE_KEY),
    revokedAt: REVOKED_AT,
  },
];

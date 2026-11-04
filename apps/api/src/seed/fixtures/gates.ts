import { gateQrLink } from '../../domain/entries/gateToken.ts';
import { hashDeviceKey } from '../../domain/gates/hashDeviceKey.ts';
import type { gate, gateDeviceKey } from '../../infrastructure/postgres/schema.ts';
import { GARAGE_ROY_ID } from './garageRoy.ts';
import { PARKING_DEMO_ID } from './parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from './parkingTestPaliers.ts';

export const ENTREE_DEMO_ID = '00000000-0000-4000-8000-000000000701';
export const SORTIE_DEMO_ID = '00000000-0000-4000-8000-000000000702';
export const ENTREE_ROY_ID = '00000000-0000-4000-8000-000000000703';

export const ENTREE_DEMO_DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
export const SORTIE_DEMO_DEVICE_KEY = 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw';
export const ENTREE_ROY_DEVICE_KEY = 'qwWc90SgLYX15MzN2UBX8lSQA-hKBlaqbIG9v--98tM';
export const ENTREE_PALIERS_ID = '00000000-0000-4000-8000-000000000704';
export const ENTREE_PALIERS_DEVICE_KEY = 'sC_lGeu2tZI7I7wrV2XOaNkKqo8r45zbvGOIROUKCPo';
export const REVOKED_ENTREE_DEMO_DEVICE_KEY = 'L-xYpKfzUH4NHKxi_r6EKJbBXOIiYvhbawTSt34sgRs';

// Development-only QR secrets, fixed so the printed demo QRs stay the same from one seed to the next.
const ENTREE_DEMO_QR_SECRET = 'yyjpDWRCZm_vTBSRn1E5B9ExTvklzWnyhygcOQIFPiE';
const SORTIE_DEMO_QR_SECRET = 'KARsBq4xkQ5CC0f4niXpE-m5VIngbyCgh5AsC5ZEYWg';
const ENTREE_ROY_QR_SECRET = 'GMFyEaQ-_nJfRymq45V_h6o-yU6H94Nu2sbpwm8fkDI';

const ENTREE_PALIERS_QR_SECRET = 'm-WlQo2sUdvRO31bTDGcYrEmCVU7YFHO_pfI8BwSd6I';

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
    qrSecret: ENTREE_DEMO_QR_SECRET,
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
    qrSecret: SORTIE_DEMO_QR_SECRET,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: ENTREE_ROY_ID,
    lotId: GARAGE_ROY_ID,
    name: 'Entrée Roy',
    kind: 'ENTRY',
    integrationKind: 'DRY_CONTACT',
    hasLoops: true,
    qrSecret: ENTREE_ROY_QR_SECRET,
  },
  {
    id: ENTREE_PALIERS_ID,
    lotId: PARKING_TEST_PALIERS_ID,
    name: 'Entrée Paliers',
    kind: 'ENTRY',
    integrationKind: 'SIMULATED',
    hasLoops: true,
    qrSecret: ENTREE_PALIERS_QR_SECRET,
    verifiedAt: VERIFIED_AT,
  },
];

// What each printed QR holds, for a tester to paste into the app's Scanner tab.
export function seededQrLinks(): readonly { readonly gateName: string; readonly link: string }[] {
  return gateFixtures.flatMap(({ id, name, qrSecret }) =>
    id === undefined || qrSecret === undefined || qrSecret === null ? [] : [{ gateName: name, link: gateQrLink(id, qrSecret) }],
  );
}

export const gateDeviceKeyFixtures: (typeof gateDeviceKey.$inferInsert)[] = [
  { id: '00000000-0000-4000-8000-000000000601', gateId: ENTREE_DEMO_ID, keyHash: hashDeviceKey(ENTREE_DEMO_DEVICE_KEY) },
  { id: '00000000-0000-4000-8000-000000000602', gateId: SORTIE_DEMO_ID, keyHash: hashDeviceKey(SORTIE_DEMO_DEVICE_KEY) },
  { id: '00000000-0000-4000-8000-000000000603', gateId: ENTREE_ROY_ID, keyHash: hashDeviceKey(ENTREE_ROY_DEVICE_KEY) },
  { id: '00000000-0000-4000-8000-000000000605', gateId: ENTREE_PALIERS_ID, keyHash: hashDeviceKey(ENTREE_PALIERS_DEVICE_KEY) },
  {
    id: '00000000-0000-4000-8000-000000000604',
    gateId: ENTREE_DEMO_ID,
    keyHash: hashDeviceKey(REVOKED_ENTREE_DEMO_DEVICE_KEY),
    revokedAt: REVOKED_AT,
  },
];

import type { operator } from '../../infrastructure/postgres/schema.ts';

export const LAVOIE_OPERATOR_ID = '00000000-0000-4000-8000-000000000101';
export const ROY_OPERATOR_ID = '00000000-0000-4000-8000-000000000102';

export const operatorFixtures: (typeof operator.$inferInsert)[] = [
  { id: LAVOIE_OPERATOR_ID, legalName: 'Stationnements Lavoie inc.', kycStatus: 'VERIFIED' },
  { id: ROY_OPERATOR_ID, legalName: 'Garages Roy', kycStatus: 'NOT_STARTED' },
];

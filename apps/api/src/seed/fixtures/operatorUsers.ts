import type { appUser, operatorMember } from '../../infrastructure/postgres/schema.ts';
import { AMELIE_LAVOIE_ID, ERIC_DUFRESNE_ID, JULIE_TREMBLAY_ID, MARC_GAGNON_ID, NADIA_BOUCHARD_ID } from './drivers.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from './operators.ts';

export const SOPHIE_LAVOIE_ID = '00000000-0000-4000-8000-000000000601';
export const PIERRE_ROY_ID = '00000000-0000-4000-8000-000000000602';
export const NOUVEL_OPERATEUR_ID = '00000000-0000-4000-8000-000000000603';

export const OPERATOR_PERSONA_IDS: readonly string[] = [SOPHIE_LAVOIE_ID, PIERRE_ROY_ID, NOUVEL_OPERATEUR_ID];

// The dashboard's test list: the operator personas, then the named drivers, so a tester can see a driver has no operator.
export const DASHBOARD_TEST_USER_IDS: readonly string[] = [
  ...OPERATOR_PERSONA_IDS,
  JULIE_TREMBLAY_ID,
  MARC_GAGNON_ID,
  NADIA_BOUCHARD_ID,
  AMELIE_LAVOIE_ID,
  ERIC_DUFRESNE_ID,
];

export const operatorUserFixtures: (typeof appUser.$inferInsert)[] = [
  { id: SOPHIE_LAVOIE_ID, email: 'sophie.lavoie@palier.test', firstName: 'Sophie', lastName: 'Lavoie' },
  { id: PIERRE_ROY_ID, email: 'pierre.roy@palier.test', firstName: 'Pierre', lastName: 'Roy' },
  { id: NOUVEL_OPERATEUR_ID, email: 'nouvel.operateur@palier.test', firstName: 'Nouvel', lastName: 'Opérateur' },
];

// Nouvel Opérateur has no membership on purpose: signing in as them shows the create-operator page.
export const operatorMemberFixtures: (typeof operatorMember.$inferInsert)[] = [
  { userId: SOPHIE_LAVOIE_ID, operatorId: LAVOIE_OPERATOR_ID },
  { userId: PIERRE_ROY_ID, operatorId: ROY_OPERATOR_ID },
];

import { NOUVEL_OPERATEUR_ID, PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../config/testPersonas.ts';
import type { appUser, operatorMember } from '../../infrastructure/postgres/schema.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from './operators.ts';

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

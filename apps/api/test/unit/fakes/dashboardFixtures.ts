import type { Driver } from '../../../src/domain/drivers/Driver.ts';
import { NOUVEL_OPERATEUR_ID, PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../../src/seed/fixtures/operatorUsers.ts';

export const sophie: Driver = { id: SOPHIE_LAVOIE_ID, firstName: 'Sophie', lastName: 'Lavoie' };
export const pierre: Driver = { id: PIERRE_ROY_ID, firstName: 'Pierre', lastName: 'Roy' };
export const nouvelOperateur: Driver = { id: NOUVEL_OPERATEUR_ID, firstName: 'Nouvel', lastName: 'Opérateur' };

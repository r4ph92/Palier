import {
  AMELIE_LAVOIE_ID,
  ERIC_DUFRESNE_ID,
  JULIE_TREMBLAY_ID,
  MARC_GAGNON_ID,
  NADIA_BOUCHARD_ID,
} from '../../config/testPersonas.ts';
import type { appUser } from '../../infrastructure/postgres/schema.ts';

export const STRIPE_TEST_VISA = 'pm_card_visa';
// Stripe's test token for 4000 0000 0000 0341: the card attaches, but charges to it fail.
const STRIPE_TEST_CHARGE_FAILS = 'pm_card_chargeCustomerFail';

export interface DriverPersona {
  readonly user: typeof appUser.$inferInsert;
  readonly testPaymentMethod: string | null;
  // Nadia has not accepted the notice, so signing her in shows it.
  readonly acceptedNotice: boolean;
}

export const driverPersonas: readonly DriverPersona[] = [
  {
    user: { id: JULIE_TREMBLAY_ID, email: 'julie.tremblay@palier.test', firstName: 'Julie', lastName: 'Tremblay' },
    testPaymentMethod: STRIPE_TEST_VISA,
    acceptedNotice: true,
  },
  {
    user: { id: MARC_GAGNON_ID, email: 'marc.gagnon@palier.test', firstName: 'Marc', lastName: 'Gagnon' },
    testPaymentMethod: STRIPE_TEST_VISA,
    acceptedNotice: true,
  },
  {
    user: { id: NADIA_BOUCHARD_ID, email: 'nadia.bouchard@palier.test', firstName: 'Nadia', lastName: 'Bouchard' },
    testPaymentMethod: null,
    acceptedNotice: false,
  },
  {
    user: { id: AMELIE_LAVOIE_ID, email: 'amelie.lavoie@palier.test', firstName: 'Amélie', lastName: 'Lavoie' },
    testPaymentMethod: STRIPE_TEST_VISA,
    acceptedNotice: true,
  },
  {
    user: { id: ERIC_DUFRESNE_ID, email: 'eric.dufresne@palier.test', firstName: 'Éric', lastName: 'Dufresne' },
    testPaymentMethod: STRIPE_TEST_CHARGE_FAILS,
    acceptedNotice: true,
  },
];

import type { appUser } from '../../infrastructure/postgres/schema.ts';

export const JULIE_TREMBLAY_ID = '00000000-0000-4000-8000-000000000501';
export const MARC_GAGNON_ID = '00000000-0000-4000-8000-000000000502';
export const NADIA_BOUCHARD_ID = '00000000-0000-4000-8000-000000000503';
export const AMELIE_LAVOIE_ID = '00000000-0000-4000-8000-000000000504';
export const ERIC_DUFRESNE_ID = '00000000-0000-4000-8000-000000000505';

const STRIPE_TEST_VISA = 'pm_card_visa';
// Stripe's test token for 4000 0000 0000 0341: the card attaches, but charges to it fail.
const STRIPE_TEST_CHARGE_FAILS = 'pm_card_chargeCustomerFail';

export interface DriverPersona {
  readonly user: typeof appUser.$inferInsert;
  readonly testPaymentMethod: string | null;
}

export const driverPersonas: readonly DriverPersona[] = [
  {
    user: { id: JULIE_TREMBLAY_ID, email: 'julie.tremblay@palier.test', firstName: 'Julie', lastName: 'Tremblay' },
    testPaymentMethod: STRIPE_TEST_VISA,
  },
  {
    user: { id: MARC_GAGNON_ID, email: 'marc.gagnon@palier.test', firstName: 'Marc', lastName: 'Gagnon' },
    testPaymentMethod: STRIPE_TEST_VISA,
  },
  {
    user: { id: NADIA_BOUCHARD_ID, email: 'nadia.bouchard@palier.test', firstName: 'Nadia', lastName: 'Bouchard' },
    testPaymentMethod: null,
  },
  {
    user: { id: AMELIE_LAVOIE_ID, email: 'amelie.lavoie@palier.test', firstName: 'Amélie', lastName: 'Lavoie' },
    testPaymentMethod: STRIPE_TEST_VISA,
  },
  {
    user: { id: ERIC_DUFRESNE_ID, email: 'eric.dufresne@palier.test', firstName: 'Éric', lastName: 'Dufresne' },
    testPaymentMethod: STRIPE_TEST_CHARGE_FAILS,
  },
];

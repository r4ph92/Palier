// The test sign-in routes and the seed share these ids, so the routes never import seed data.
export const JULIE_TREMBLAY_ID = '00000000-0000-4000-8000-000000000501';
export const MARC_GAGNON_ID = '00000000-0000-4000-8000-000000000502';
export const NADIA_BOUCHARD_ID = '00000000-0000-4000-8000-000000000503';
export const AMELIE_LAVOIE_ID = '00000000-0000-4000-8000-000000000504';
export const ERIC_DUFRESNE_ID = '00000000-0000-4000-8000-000000000505';

export const SOPHIE_LAVOIE_ID = '00000000-0000-4000-8000-000000000601';
export const PIERRE_ROY_ID = '00000000-0000-4000-8000-000000000602';
export const NOUVEL_OPERATEUR_ID = '00000000-0000-4000-8000-000000000603';

// The app's test list, in the order it shows them; operator personas sign in to the dashboard only.
export const DRIVER_PERSONA_IDS: readonly string[] = [AMELIE_LAVOIE_ID, ERIC_DUFRESNE_ID, JULIE_TREMBLAY_ID, MARC_GAGNON_ID, NADIA_BOUCHARD_ID];

export const OPERATOR_PERSONA_IDS: readonly string[] = [SOPHIE_LAVOIE_ID, PIERRE_ROY_ID, NOUVEL_OPERATEUR_ID];

// The dashboard's test list: the operator personas, then the named drivers, so a tester can see a driver has no operator.
export const DASHBOARD_TEST_USER_IDS: readonly string[] = [...OPERATOR_PERSONA_IDS, ...DRIVER_PERSONA_IDS];

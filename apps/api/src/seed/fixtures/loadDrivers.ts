import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { vehicle } from '../../infrastructure/postgres/schema.ts';
import { STRIPE_TEST_VISA, type DriverPersona } from './drivers.ts';
import { defaultVehicle } from './vehicles.ts';

export const LOAD_DRIVER_COUNT = 20;
const FIRST_LOAD_DRIVER_SEQUENCE = 521;

// Electric with a permit and not oversize: every Parking Démo spot fits it (A-5 electric, B-5 accessible, B-4 oversize takes any car).
export const LOAD_VEHICLE_NEEDS: VehicleNeeds = { isElectric: true, hasAccessiblePermit: true, isOversize: false };

interface LoadDriver {
  readonly persona: DriverPersona;
  readonly vehicle: typeof vehicle.$inferInsert;
}

function twoDigits(sequence: number): string {
  return String(sequence).padStart(2, '0');
}

function loadDriverId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(FIRST_LOAD_DRIVER_SEQUENCE + sequence - 1).padStart(12, '0')}`;
}

// Conducteur Test 01 to 20, for the entry load script only: they stay off the app's test sign-in list.
// The simulated customer and card let them enter under PAYMENTS_SIMULATION=success; a seed with a Stripe key replaces them.
function loadDriverPersona(id: string, number: string): DriverPersona {
  return {
    user: {
      id,
      email: `conducteur.test${number}@palier.test`,
      firstName: 'Conducteur',
      lastName: `Test ${number}`,
      stripeCustomerId: `cus_sim_${number}`,
      defaultPmId: `pm_sim_${number}`,
      cardBrand: 'visa',
      cardLast4: '4242',
    },
    testPaymentMethod: STRIPE_TEST_VISA,
    acceptedNotice: true,
  };
}

function loadDriver(sequence: number): LoadDriver {
  const id = loadDriverId(sequence);
  const number = twoDigits(sequence);
  return { persona: loadDriverPersona(id, number), vehicle: defaultVehicle(id, `TEST 0${number}`, LOAD_VEHICLE_NEEDS) };
}

const loadDrivers: readonly LoadDriver[] = Array.from({ length: LOAD_DRIVER_COUNT }, (_, index) => loadDriver(index + 1));

export const loadDriverPersonas: readonly DriverPersona[] = loadDrivers.map(({ persona }) => persona);

export const loadDriverVehicles: readonly (typeof vehicle.$inferInsert)[] = loadDrivers.map((driver) => driver.vehicle);

export const LOAD_DRIVER_IDS: readonly string[] = loadDriverPersonas.flatMap(({ user }) => (user.id === undefined ? [] : [user.id]));

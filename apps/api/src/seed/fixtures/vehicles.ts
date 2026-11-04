import { readPlate } from '../../domain/vehicles/plate.ts';
import type { vehicle } from '../../infrastructure/postgres/schema.ts';
import { AMELIE_LAVOIE_ID, ERIC_DUFRESNE_ID, JULIE_TREMBLAY_ID, MARC_GAGNON_ID } from './drivers.ts';

const QUEBEC = 'QC';

function defaultVehicle(userId: string, typedPlate: string): typeof vehicle.$inferInsert {
  const plate = readPlate(typedPlate);
  if (plate === null) {
    throw new Error(`The seeded plate "${typedPlate}" is not a valid plate.`);
  }
  return { userId, ...plate, province: QUEBEC, isDefault: true };
}

// Nadia has no vehicle, so scanning a QR as her shows the missing prerequisites.
export const vehicleFixtures: readonly (typeof vehicle.$inferInsert)[] = [
  defaultVehicle(JULIE_TREMBLAY_ID, 'ABC 123'),
  defaultVehicle(MARC_GAGNON_ID, 'XYZ 789'),
  defaultVehicle(AMELIE_LAVOIE_ID, 'EVA 001'),
  defaultVehicle(ERIC_DUFRESNE_ID, 'DEC 404'),
];

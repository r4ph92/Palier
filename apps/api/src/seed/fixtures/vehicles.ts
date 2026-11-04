import { readPlate } from '../../domain/vehicles/plate.ts';
import type { VehicleNeeds } from '../../domain/vehicles/VehicleRepository.ts';
import type { vehicle } from '../../infrastructure/postgres/schema.ts';
import { AMELIE_LAVOIE_ID, ERIC_DUFRESNE_ID, JULIE_TREMBLAY_ID, MARC_GAGNON_ID } from '../../config/testPersonas.ts';

const QUEBEC = 'QC';

const STANDARD: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

export function defaultVehicle(userId: string, typedPlate: string, needs: VehicleNeeds = STANDARD): typeof vehicle.$inferInsert {
  const plate = readPlate(typedPlate);
  if (plate === null) {
    throw new Error(`The seeded plate "${typedPlate}" is not a valid plate.`);
  }
  return { userId, ...plate, province: QUEBEC, isDefault: true, ...needs };
}

// Nadia has no vehicle, so scanning a QR as her shows the missing prerequisites.
// Amélie's car is electric and she holds a permit, so her entry shows the needs filter (#44).
export const vehicleFixtures: readonly (typeof vehicle.$inferInsert)[] = [
  defaultVehicle(JULIE_TREMBLAY_ID, 'ABC 123'),
  defaultVehicle(MARC_GAGNON_ID, 'XYZ 789'),
  defaultVehicle(AMELIE_LAVOIE_ID, 'EVA 001', { isElectric: true, hasAccessiblePermit: true, isOversize: false }),
  defaultVehicle(ERIC_DUFRESNE_ID, 'DEC 404'),
];

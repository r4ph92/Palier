import { driverPersonas, type DriverPersona } from './drivers.ts';
import { loadDriverPersonas, loadDriverVehicles } from './loadDrivers.ts';
import { vehicleFixtures } from './vehicles.ts';
import type { vehicle } from '../../infrastructure/postgres/schema.ts';

export const seededDriverPersonas: readonly DriverPersona[] = [...driverPersonas, ...loadDriverPersonas];

export const seededVehicles: readonly (typeof vehicle.$inferInsert)[] = [...vehicleFixtures, ...loadDriverVehicles];
